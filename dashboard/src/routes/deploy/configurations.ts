import type { MacSigningPreparation, MacSigningProgress, ReleaseDeploymentConfig } from '../../../electron/types';
import {
    createDynamicForm,
    type DynamicFieldDefinition,
    type DynamicFormController,
    type DynamicFormLayout,
} from '../../shared/ui/dynamic-form';
import { createFormController } from '../../shared/ui/form-state';
import { createContentPanel } from '../../shared/ui/content-panel';
import { renderPageHeader } from '../../shared/ui/page-header';
import { showAlert, showChoiceModal, showModal, showTechnicalError } from '../../shared/ui/modal';
import { createPanelHeaderAction } from '../../shared/ui/panel';
import { createHelpSidebar, type HelpSidebarContent } from '../../shared/ui/help-sidebar';
import { createSetupGuide, type SetupGuideStep } from '../../shared/ui/setup-guide';
import { createDataTable } from '../../shared/ui/data-table';

let macSigningProgressSink: ((progress: MacSigningProgress) => void) | undefined;
window.buildApi.onMacSigningProgress((progress) => macSigningProgressSink?.(progress));

type GroupValues = Record<string, unknown>;

interface GuideLink { label: string; url: string; }
type ConfigurationField = DynamicFieldDefinition<GroupValues> & { links?: GuideLink[] };

interface ConfigurationGroup {
    title: string;
    description: string;
    guide: SetupGuideStep[];
    fields: ConfigurationField[];
    layout: DynamicFormLayout<GroupValues>;
}

const required = (field: ConfigurationField): ConfigurationField => ({
    clearable: true,
    required: true,
    ...field,
});

const groups: ConfigurationGroup[] = [
    {
        title: 'Repository & automation',
        description: 'Choose where release source, immutable builds, and GitHub Actions automation are managed.',
        guide: [
            { title: 'Local release repository', description: 'Create an empty GitHub repository, clone it beside this project, then select that cloned folder.', link: { label: 'Create a GitHub repository', url: 'https://github.com/new' }, values: [
                { label: 'Repository name', value: 'hh-dev-releases' },
                { label: 'Clone command', value: 'gh repo clone <owner>/hh-dev-releases' },
                { label: 'Selected folder', value: '<Projects>/hh-dev-releases' },
            ], note: 'The dashboard detects owner/name from origin and installs the workflow automatically.' },
            { title: 'GitHub repository', description: 'This field is read-only. It comes from the selected folder’s origin remote.', link: { label: 'Remote URL guide', url: 'https://docs.github.com/en/get-started/getting-started-with-git/managing-remote-repositories' }, values: [
                { label: 'Expected value', value: '<owner>/hh-dev-releases' },
            ] },
            { title: 'Release branch', description: 'Use the branch that receives release-control commits.', values: [
                { label: 'Recommended value', value: 'main' },
            ] },
            { title: 'Authorize automatic GitHub setup', description: 'Leave the token field empty when GitHub CLI is already authenticated. Otherwise create a fine-grained token for this repository.', link: { label: 'GitHub CLI authentication', url: 'https://cli.github.com/manual/gh_auth_login' }, values: [
                { label: 'CLI command', value: 'gh auth login' },
                { label: 'Repository access', value: 'Only select repositories: hh-dev-releases' },
                { label: 'Secrets', value: 'Read and write' },
                { label: 'Administration', value: 'Read and write' },
            ], note: 'On save, the dashboard enables all Actions, turns SHA pinning off for the generated @v4 workflow, sets workflow permissions to read/write, disables pull-request approval, and synchronizes repository secrets. Other Actions settings are unrelated and remain unchanged.' },
        ],
        fields: [
            required({ key: 'releaseRepositoryPath', type: 'file', label: 'Local release repository', chooseFile: () => window.buildApi.pickFolder(), description: 'Select the cloned repository root containing .git. Recommended location: a sibling of the game project, for example /Projects/hh-dev-releases. Do not select the game project or this dashboard source folder.', links: [{ label: 'Create a GitHub repository', url: 'https://github.com/new' }, { label: 'Git clone guide', url: 'https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository' }] }),
            { key: 'repository', type: 'text', label: 'GitHub repository', readOnly: true, placeholder: 'Detected from Git origin', description: 'Read-only owner/name detected from origin, for example mtuan/hh-dev-releases. If wrong, correct the selected repository’s origin remote.' },
            { key: 'branch', type: 'text', label: 'Release branch', placeholder: 'main', description: 'Use main for a new repository. Enter another existing branch only when your team deliberately keeps release control there. The dashboard pushes build requests and production pointers to this branch.', links: [{ label: 'Git authentication guide', url: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github' }] },
            { key: 'githubAuthStatus', type: 'text', label: 'GitHub authentication', readOnly: true, placeholder: 'Checked after selecting a repository', description: 'Shows whether automatic GitHub configuration will use the token below or the machine’s authenticated GitHub CLI session.' },
            { key: 'githubToken', type: 'password', label: 'GitHub token (optional)', description: 'Leave blank to use an authenticated GitHub CLI session. Otherwise use a fine-grained token restricted to this repository with Actions, Secrets, and Administration read/write access. The credential configures Actions permissions and synchronizes secrets; Git still publishes builds and promotions.', links: [{ label: 'Authenticate GitHub CLI', url: 'https://cli.github.com/manual/gh_auth_login' }, { label: 'Create fine-grained token', url: 'https://github.com/settings/personal-access-tokens/new' }, { label: 'Fine-grained permissions', url: 'https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens' }] },
        ],
        layout: [['releaseRepositoryPath'], ['repository', 'branch'], ['githubAuthStatus'], ['githubToken']],
    },
    {
        title: 'Update hosting',
        description: 'Host installers and automatic updates in the same public GitHub release repository.',
        guide: [
            { title: 'GitHub Releases hosting', description: 'Saving makes the selected repository public and configures signed installers and update metadata to publish there.', link: { label: 'GitHub Releases documentation', url: 'https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases' }, values: [
                { label: 'Repository', value: 'https://github.com/<owner>/hh-dev-releases' },
                { label: 'Visibility', value: 'Public' },
            ], note: 'Installed dashboards download anonymously. No GitHub or Cloudflare credential is stored on developer machines.' },
            { title: 'Production release', description: 'Roll to production marks the selected immutable GitHub Release as latest. Selecting an older release rolls back without another hosting service.' },
        ],
        fields: [
            { key: 'updateBaseUrl', type: 'url', label: 'GitHub Releases URL', readOnly: true, placeholder: 'Detected from the selected GitHub repository', description: 'Public first-install downloads and automatic updates are hosted by GitHub Releases in the selected repository.' },
        ],
        layout: [['updateBaseUrl']],
    },
    {
        title: 'macOS signing & notarization',
        description: 'Optional. Configure this complete group to enable independent signed and notarized macOS builds.',
        guide: [
            { title: 'Developer ID certificate', description: 'Use the lock action in this panel. The dashboard detects an installed Developer ID Application identity, exports only the selected team identity, generates its password, validates it, and fills both fields.', link: { label: 'Apple certificate instructions', url: 'https://developer.apple.com/help/account/certificates/create-developer-id-certificates' }, values: [
                { label: 'Certificate type', value: 'Developer ID Application' },
                { label: 'File format', value: '.p12' },
            ], note: 'If no identity exists, the dashboard opens Xcode and explains Apple’s one required manual certificate-creation step. Approve the normal Keychain prompt during export.' },
            { title: 'Certificate password', description: 'The dashboard generates a strong password and uploads it with the validated certificate when GitHub authentication is available.' },
            { title: 'Apple ID', description: 'Enter the email address of an Apple ID in the same developer team as the certificate.', link: { label: 'Apple Developer account', url: 'https://developer.apple.com/account/' } },
            { title: 'App-specific password', description: 'At account.apple.com, open Sign-In and Security → App-Specific Passwords. Choose Generate an app-specific password, enter the label below, click Create, then copy Apple’s generated password into the App-specific password field in this panel. The label only helps you recognize this credential later.', link: { label: 'Open Apple account security', url: 'https://account.apple.com/account/manage' }, values: [
                { label: 'Password label', value: 'Cocos Build Dashboard GitHub Actions', copyValue: 'Cocos Build Dashboard GitHub Actions' },
                { label: 'Password type', value: 'App-specific password' },
                { label: 'Paste generated value into', value: 'App-specific password' },
            ], note: 'Do not enter your normal Apple ID password or Mac login password. Apple shows the generated password once, so copy it before closing the dialog.' },
            { title: 'Apple team ID', description: 'Copy the team ID from Apple Developer Membership details.', link: { label: 'Team ID guide', url: 'https://developer.apple.com/help/account/manage-your-team/locate-your-team-id/' }, values: [
                { label: 'Team ID', value: '10 characters, for example A1B2C3D4E5' },
            ] },
        ],
        fields: [
            required({ key: 'macCertificate', type: 'file', label: 'Developer ID certificate', accept: '.p12,.pfx', chooseFile: () => window.buildApi.pickFile(), description: 'Use the lock action in this panel to detect, export, validate, and fill this automatically. Manual file selection remains available for an existing encrypted .p12.', links: [{ label: 'Create Developer ID certificate', url: 'https://developer.apple.com/help/account/certificates/create-developer-id-certificates' }] }),
            required({ key: 'macCertificatePassword', type: 'password', label: 'Certificate password', description: 'Filled automatically with the strong password generated for the managed .p12 export. Enter it manually only when selecting your own existing archive.' }),
            required({ key: 'appleId', type: 'email', label: 'Apple ID', description: 'Enter the Apple ID email that belongs to the Apple Developer team used to sign this application.', links: [{ label: 'Open Apple Developer account', url: 'https://developer.apple.com/account/' }] }),
            required({ key: 'appleAppPassword', type: 'password', label: 'App-specific password', description: 'At account.apple.com, open Sign-In and Security → App-Specific Passwords. Generate one using the label “Cocos Build Dashboard GitHub Actions”, then paste Apple’s generated password here—not the label, Apple ID password, or Mac login password.', links: [{ label: 'Manage Apple Account', url: 'https://account.apple.com/account/manage' }, { label: 'App-specific password guide', url: 'https://support.apple.com/en-us/102654' }] }),
            required({ key: 'appleTeamId', type: 'text', label: 'Apple team ID', description: 'Open developer.apple.com/account and view Membership details. Copy the 10-character Team ID for the team that owns the Developer ID certificate.', links: [{ label: 'Locate your Team ID', url: 'https://developer.apple.com/help/account/manage-your-team/locate-your-team-id/' }] }),
        ],
        layout: [['macCertificate', 'macCertificatePassword'], ['appleId', 'appleAppPassword'], ['appleTeamId']],
    },
    {
        title: 'Windows signing',
        description: 'Optional. Configure this complete group to enable independent signed Windows builds.',
        guide: [
            { title: 'Authenticode certificate', description: 'Obtain a code-signing certificate and export it together with its private key.', link: { label: 'Microsoft Authenticode guide', url: 'https://learn.microsoft.com/en-us/windows-hardware/drivers/install/authenticode' }, values: [
                { label: 'Certificate type', value: 'Authenticode code-signing certificate' },
                { label: 'File format', value: '.pfx or .p12' },
                { label: 'Example filename', value: 'CodeSigning.pfx' },
            ] },
            { title: 'Certificate password', description: 'Enter the password chosen while exporting the .pfx or .p12 file.', link: { label: 'Electron signing guide', url: 'https://www.electron.build/code-signing-win.html' } },
            { title: 'Publisher name', description: 'Open the certificate details and copy its Subject/Common Name exactly.', values: [
                { label: 'Publisher example', value: 'HayHay Co., Ltd.' },
            ], note: 'Do not use the app name unless it exactly matches the certificate identity.' },
        ],
        fields: [
            required({ key: 'windowsCertificate', type: 'file', label: 'Authenticode certificate', accept: '.p12,.pfx', chooseFile: () => window.buildApi.pickFile(), description: 'Obtain a code-signing certificate from a trusted certificate authority. Export the certificate together with its private key as a password-protected .pfx or .p12 file, then choose that file here.', links: [{ label: 'Microsoft Authenticode overview', url: 'https://learn.microsoft.com/en-us/windows-hardware/drivers/install/authenticode' }, { label: 'Electron Windows signing guide', url: 'https://www.electron.build/code-signing-win.html' }] }),
            required({ key: 'windowsCertificatePassword', type: 'password', label: 'Certificate password', description: 'Enter the password used when the Windows code-signing certificate and private key were exported to the .pfx or .p12 file.', links: [{ label: 'Electron certificate formats', url: 'https://www.electron.build/code-signing-win.html' }] }),
            required({ key: 'windowsPublisherName', type: 'text', label: 'Publisher name', description: 'Enter the exact Subject/Common Name printed in the Authenticode certificate. It must match the publisher identity in the certificate, including punctuation and company suffixes.', links: [{ label: 'Windows signing configuration', url: 'https://www.electron.build/code-signing-win.html' }] }),
        ],
        layout: [['windowsCertificate', 'windowsCertificatePassword'], ['windowsPublisherName']],
    },
];

function groupValues(config: ReleaseDeploymentConfig, fields: DynamicFieldDefinition<GroupValues>[]): GroupValues {
    return Object.fromEntries(fields.map((field) => [field.key, config[field.key as keyof ReleaseDeploymentConfig] ?? '']));
}

function createGroupHelp(group: ConfigurationGroup, config: ReleaseDeploymentConfig): HelpSidebarContent {
    const owner = config.repository.split('/')[0] || '<owner>';
    const replace = (value: string): string => value.replaceAll('<owner>', owner);
    const guide = group.guide.map((step) => ({
        ...step,
        ...(step.link ? { link: { ...step.link, url: replace(step.link.url) } } : {}),
        ...(step.values ? { values: step.values.map((value) => ({ ...value, value: replace(value.value), ...(value.copyValue ? { copyValue: replace(value.copyValue) } : {}) })) } : {}),
    }));
    return { key: group.title, title: `${group.title} guide`, content: createSetupGuide(guide) };
}

export function renderDeployConfigurations(options: { header: HTMLElement; content: HTMLElement; config: ReleaseDeploymentConfig }): void {
    renderPageHeader(options.header, {
        title: 'Deploy configurations',
        description: 'Configure release automation and one or more signing platforms. A release is ready when repository settings and at least one complete platform group are saved; other platforms remain optional.',
        actions: [{ id: 'deploy-config-save', label: 'Save configurations', className: 'btn-primary', symbol: 'save' }],
    });
    const saveButton = options.header.querySelector<HTMLButtonElement>('#deploy-config-save')!;
    let savedConfig = options.config;
    const forms: Array<{ group: ConfigurationGroup; form: DynamicFormController<GroupValues> }> = groups.map((group) => ({
        group,
        form: createDynamicForm<GroupValues>({ initialValues: groupValues(savedConfig, group.fields), fields: group.fields, layout: group.layout }),
    }));
    forms[0].form.onChange((_values, changedKey) => {
        if (changedKey !== 'releaseRepositoryPath') return;
        const repositoryPath = String(forms[0].form.values.releaseRepositoryPath ?? '');
        if (!repositoryPath) { forms[0].form.patch({ repository: '', githubAuthStatus: '' }); return; }
        void window.buildApi.inspectReleaseRepository(repositoryPath)
            .then((inspection) => { forms[0].form.patch(inspection); forms[1].form.patch({ updateBaseUrl: inspection.updateBaseUrl }); })
            .catch(() => forms[0].form.patch({ repository: '', githubAuthStatus: 'Repository inspection failed' }));
    });
    const read = (): ReleaseDeploymentConfig => ({
        ...savedConfig,
        ...Object.assign({}, ...forms.map(({ form }) => form.values)),
    }) as ReleaseDeploymentConfig;
    const controller = createFormController({
        read,
        saveButton,
        save: async (config) => {
            try {
                const saved = await window.buildApi.saveReleaseDeploymentConfig(config);
                savedConfig = saved;
                forms.forEach(({ group, form }) => form.reset(groupValues(saved, group.fields)));
            } catch (error) {
                showTechnicalError('Could not save deployment configuration', 'The local configuration or GitHub Actions secrets could not be updated.', error instanceof Error ? error.stack ?? error.message : String(error));
                throw error;
            }
        },
    });
    forms.forEach(({ form }) => form.onChange(() => controller.changed()));

    const macSigningForm = forms.find(({ group }) => group.title === 'macOS signing & notarization')!.form;
    const finishMacSigning = (result: MacSigningPreparation): void => {
        macSigningForm.patch({ macCertificate: result.macCertificate, macCertificatePassword: result.macCertificatePassword, appleTeamId: result.appleTeamId });
        controller.changed();
        showAlert(result.githubSecretsUploaded
            ? 'The Developer ID identity was exported, validated, filled in, and uploaded to GitHub Actions secrets. Save configurations to keep the local settings.'
            : 'The Developer ID identity was exported, validated, and filled in. Save configurations to keep the settings; GitHub secrets will synchronize when repository authentication is available.', 'Developer ID is ready');
    };
    const trackedMacSigning = async (teamId: string | undefined, identityName: string): Promise<void> => {
        const phases: MacSigningProgress['phase'][] = ['identity', 'authorization', 'validation', 'github'];
        const titles: Record<MacSigningProgress['phase'], string> = { identity: 'Developer ID identity', authorization: 'Private-key approval', validation: 'Export validation', github: 'GitHub Actions secrets' };
        const records = new Map<MacSigningProgress['phase'], MacSigningProgress>(phases.map((phase) => [phase, { phase, status: phase === 'identity' ? 'complete' : 'pending', detail: phase === 'identity' ? `${identityName} selected.` : 'Waiting for the previous step.' }]));
        const table = createDataTable<MacSigningProgress>({
            items: [...records.values()], keyOf: (item) => item.phase,
            columns: [
                { id: 'step', label: 'Configuration', render: (item) => titles[item.phase] },
                { id: 'detail', label: 'What is required', render: (item) => item.detail },
                { id: 'status', label: 'Status', width: '110px', render: (item) => { const badge = document.createElement('span'); badge.className = `badge ${item.status === 'complete' ? 'badge-success' : item.status === 'active' ? 'badge-running' : 'badge-neutral'}`; badge.textContent = item.status === 'complete' ? 'Approved' : item.status === 'active' ? 'Next' : item.status === 'skipped' ? 'Later' : 'Waiting'; return badge; } },
            ],
        });
        const modal = showModal({ title: 'Prepare macOS signing', icon: 'settings', content: table.element, closeOnBackdrop: false });
        macSigningProgressSink = (progress) => { records.set(progress.phase, progress); table.setItems(phases.map((phase) => records.get(phase)!)); };
        try {
            const result = await window.buildApi.prepareMacSigning(read(), teamId, true);
            modal.close();
            if (result.status === 'ready') finishMacSigning(result);
            else throw new Error(`Signing preparation returned unexpected status: ${result.status}`);
        } catch (error) {
            modal.close();
            showTechnicalError('Could not prepare macOS signing', 'The Developer ID identity could not be exported or synchronized.', error instanceof Error ? error.stack ?? error.message : String(error));
        } finally { macSigningProgressSink = undefined; }
    };
    const runMacSigning = async (teamId?: string): Promise<void> => {
        try {
            const result = await window.buildApi.prepareMacSigning(read(), teamId, false);
            if (result.status === 'ready') { finishMacSigning(result); return; }
            if (result.status === 'choose-team') {
                const selected = await showChoiceModal('Select the Apple Developer team', result.identities.map((identity) => ({ value: identity.teamId, title: identity.name, meta: `Team ID ${identity.teamId}` })));
                if (selected) await runMacSigning(selected);
                return;
            }
            if (result.status === 'authorization-required') {
                const names = result.authorizationIdentityNames ?? [];
                const content = document.createElement('div'); content.className = 'app-modal-message';
                const summary = document.createElement('p'); summary.textContent = `The dashboard will export only ${names[0] ?? 'the selected Developer ID identity'}. macOS will show one Keychain prompt. The progress rows will show exactly what is complete and what comes next.`;
                content.append(summary);
                showModal({ title: 'One Keychain approval required', icon: 'info', content, actions: [
                    { label: 'Cancel', run: (close) => close() },
                    { label: 'Start signing setup', className: 'btn-primary', run: (close) => { close(); void trackedMacSigning(result.appleTeamId, names[0] ?? 'Developer ID Application'); } },
                ] });
                return;
            }
            const content = document.createElement('div'); content.className = 'app-modal-message';
            const instruction = document.createElement('p'); instruction.textContent = 'No Developer ID Application identity with a private key was found. In Xcode, sign in with an Account Holder account, then open Settings → Accounts → Manage Certificates and create a Developer ID Application certificate.';
            const note = document.createElement('p'); note.textContent = 'Return here after Xcode finishes and choose “Check again.” Apple requires this one-time step; the dashboard will automate the export, validation, fields, and GitHub secrets afterward.';
            content.append(instruction, note);
            showModal({ title: 'Create the certificate in Xcode', icon: 'info', content, actions: [
                { label: 'Close', run: (close) => close() },
                { label: 'Open Xcode', run: (close) => { close(); void window.buildApi.openXcode().catch((error) => showTechnicalError('Could not open Xcode', 'Open Xcode manually and complete the certificate step.', String(error))); } },
                { label: 'Check again', className: 'btn-primary', run: (close) => { close(); void runMacSigning(); } },
            ] });
        } catch (error) {
            showTechnicalError('Could not prepare macOS signing', 'The Developer ID identity could not be exported or synchronized.', error instanceof Error ? error.stack ?? error.message : String(error));
        }
    };

    const layout = document.createElement('div');
    layout.className = 'deploy-config-layout';
    const stack = document.createElement('div');
    stack.className = 'deploy-panel-stack';
    const helpSidebar = createHelpSidebar();
    forms.forEach(({ group, form }) => {
        const helpButton = createPanelHeaderAction('help', `Show ${group.title} help`);
        helpButton.addEventListener('click', () => {
            helpSidebar.toggle(createGroupHelp(group, read()));
        });
        const actions = document.createElement('div'); actions.className = 'ui-panel-controls';
        if (group.title === 'macOS signing & notarization') {
            const prepareButton = createPanelHeaderAction('lock', 'Detect and export Developer ID identity');
            prepareButton.addEventListener('click', () => void runMacSigning());
            actions.appendChild(prepareButton);
        }
        actions.appendChild(helpButton);
        stack.appendChild(createContentPanel({ title: group.title, description: group.description, content: form.element, actions, collapsible: true, collapsed: false }));
    });
    layout.append(stack, helpSidebar.element);
    options.content.replaceChildren(layout);
}
