'use strict';

var http = require('http');

var server = null;
var building = false;
var activeBuild = null;

function bridgePort(projectPath) {
    var hash = 2166136261;
    for (var i = 0; i < projectPath.length; i += 1) {
        hash ^= projectPath.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return 47800 + ((hash >>> 0) % 1000);
}

function sendJson(response, statusCode, value) {
    var body = JSON.stringify(value);
    response.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    });
    response.end(body);
}

function readBody(request, done) {
    var body = '';
    request.setEncoding('utf8');
    request.on('data', function (chunk) {
        body += chunk;
        if (body.length > 1024 * 1024) request.destroy();
    });
    request.on('end', function () { done(null, body); });
    request.on('error', done);
}

function startBuild(input, response) {
    if (building) {
        sendJson(response, 409, { error: 'Cocos Creator is already building this project.' });
        return;
    }
    building = true;
    refreshManagedAssets(function (refreshError) {
        if (refreshError) {
            building = false;
            sendJson(response, 500, { error: 'Could not refresh generated loading assets before build: ' + String(refreshError) });
            return;
        }
        queryOptionsAndBuild(input, response);
    });
}

function refreshManagedAssets(done) {
    if (!Editor.assetdb || typeof Editor.assetdb.refresh !== 'function') {
        done(null);
        return;
    }
    Editor.assetdb.refresh('db://assets/resources/hayhay-loading', function (error) {
        done(error || null);
    });
}

function queryOptionsAndBuild(input, response) {
    synchronizeAndroidToolchain(input);
    Editor.Ipc.sendToMain('builder:query-build-options', function (queryError, currentOptions) {
        if (queryError) {
            building = false;
            sendJson(response, 500, { error: String(queryError) });
            return;
        }
        var platform = String(input.platform || currentOptions.platform || 'web-mobile');
        var platformOptions = input.packages && input.packages[platform] ? input.packages[platform] : {};
        var options = Object.assign({}, currentOptions, platformOptions, {
            platform: platform,
            actualPlatform: platform,
            debug: Boolean(input.debug),
            dest: require('path').join(String(input.buildPath), platform),
            buildPath: String(input.buildPath),
            outputName: String(input.outputName || input.taskName || platform)
        });
        // query-build-options may omit the panel-derived scene selection when
        // called from an extension. Creator's 2.4 builder assumes this is an
        // array and crashes in its validation before a task can start.
        if (!Array.isArray(options.scenes) || options.scenes.length === 0) {
            options.scenes = options.startScene ? [options.startScene] : [];
        }
        if (!Array.isArray(options.excludeScenes)) options.excludeScenes = [];
        if (!Array.isArray(options.excludedModules)) options.excludedModules = [];
        if (platformOptions.packageName) {
            options.packageName = platformOptions.packageName;
            options[platform] = Object.assign({}, options[platform] || {}, { packageName: platformOptions.packageName });
        }
        var previousEnvironment = process.env.COCOS_BUILD_ENV;
        var previousAndroidEnvironment = captureAndroidEnvironment();
        process.env.COCOS_BUILD_ENV = String(input.environment || 'prod');
        applyAndroidEnvironment(input.androidToolchain);
        var finished = false;
        var timeout = setTimeout(function () {
            finish(new Error('Timed out waiting for Cocos Creator to finish the build.'));
        }, 30 * 60 * 1000);

        function restoreEnvironment() {
            if (previousEnvironment === undefined) delete process.env.COCOS_BUILD_ENV;
            else process.env.COCOS_BUILD_ENV = previousEnvironment;
            restoreAndroidEnvironment(previousAndroidEnvironment);
        }

        function finish(error) {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            Editor.Builder.removeListener('build-finished', onBuildFinished);
            restoreEnvironment();
            building = false;
            activeBuild = null;
            if (error) sendJson(response, 500, { error: error.stack || error.message || String(error) });
            else sendJson(response, 200, { exitCode: 0 });
        }

        function onBuildFinished(buildOptions, callback) {
            try { callback(); } finally { finish(null); }
        }

        Editor.Builder.on('build-finished', onBuildFinished);
        activeBuild = {
            finish: finish,
            platform: platform
        };
        Editor.log('[cocos-build-dashboard-bridge] Building ' + platform + ' to ' + options.dest);
        // Creator 2.x does not reply to builder:start-task. Supplying an IPC
        // reply callback leaves some 2.4 releases waiting without starting the
        // task, so completion is observed through Builder/state events instead.
        Editor.Ipc.sendToMain('builder:start-task', 'build', options);
    });
}

function captureAndroidEnvironment() {
    return {
        ANDROID_HOME: process.env.ANDROID_HOME,
        ANDROID_SDK_ROOT: process.env.ANDROID_SDK_ROOT,
        NDK_ROOT: process.env.NDK_ROOT,
        JAVA_HOME: process.env.JAVA_HOME,
        PATH: process.env.PATH
    };
}

function applyAndroidEnvironment(toolchain) {
    if (!toolchain) return;
    if (toolchain.sdkPath) {
        process.env.ANDROID_HOME = String(toolchain.sdkPath);
        process.env.ANDROID_SDK_ROOT = String(toolchain.sdkPath);
    }
    if (toolchain.ndkPath) process.env.NDK_ROOT = String(toolchain.ndkPath);
    if (toolchain.javaHome) process.env.JAVA_HOME = String(toolchain.javaHome);
    if (toolchain.pythonPath) {
        var pythonDirectory = require('path').dirname(String(toolchain.pythonPath));
        process.env.PATH = pythonDirectory + require('path').delimiter + (process.env.PATH || '');
    }
}

function restoreAndroidEnvironment(previous) {
    Object.keys(previous).forEach(function (key) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
    });
}

function synchronizeAndroidToolchain(input) {
    var toolchain = input && input.androidToolchain;
    if (!toolchain || !Editor.Profile || typeof Editor.Profile.load !== 'function') return;
    try {
        var settings = Editor.Profile.load('global://settings.json');
        if (toolchain.ndkPath) settings.set('native.ndkPath', String(toolchain.ndkPath));
        if (toolchain.sdkPath) settings.set('native.sdkPath', String(toolchain.sdkPath));
        if (toolchain.ndkPath) settings.set('ndkPath', String(toolchain.ndkPath));
        if (toolchain.sdkPath) settings.set('sdkPath', String(toolchain.sdkPath));
        settings.save();
        Editor.log('[cocos-build-dashboard-bridge] Synchronized Android SDK/NDK preferences.');
    } catch (error) {
        Editor.warn('[cocos-build-dashboard-bridge] Could not synchronize Android preferences: ' + String(error));
    }
}

function handleBuild(request, response) {
    readBody(request, function (error, body) {
        if (error) {
            sendJson(response, 400, { error: error.message || String(error) });
            return;
        }
        try { startBuild(JSON.parse(body), response); }
        catch (parseError) { sendJson(response, 400, { error: parseError.message || String(parseError) }); }
    });
}

module.exports = {
    load: function () {
        var projectPath = Editor.Project.path;
        server = http.createServer(function (request, response) {
            if (request.method === 'GET' && request.url === '/health') {
                sendJson(response, 200, { projectPath: projectPath, creatorVersion: Editor.App.version });
                return;
            }
            if (request.method === 'POST' && request.url === '/build') {
                handleBuild(request, response);
                return;
            }
            sendJson(response, 404, { error: 'Not found.' });
        });
        server.on('error', function (error) { Editor.error('[cocos-build-dashboard-bridge] ' + error.stack); });
        server.listen(bridgePort(projectPath), '127.0.0.1', function () {
            Editor.log('[cocos-build-dashboard-bridge] Ready for dashboard builds.');
        });
    },
    unload: function () {
        if (server) server.close();
        server = null;
        if (activeBuild) activeBuild.finish(new Error('Cocos build bridge was unloaded during the build.'));
        activeBuild = null;
        building = false;
    },
    messages: {
        'builder:state-changed': function (event, type, percent) {
            if (!activeBuild) return;
            Editor.log('[cocos-build-dashboard-bridge] Build state: ' + type + (percent === undefined ? '' : ' ' + percent + '%'));
            if (type === 'error') activeBuild.finish(new Error('Cocos Creator reported a build error. Check the Creator Console for details.'));
        }
    }
};
