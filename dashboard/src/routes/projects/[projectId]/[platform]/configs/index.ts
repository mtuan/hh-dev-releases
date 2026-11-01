import { ProjectConfig } from '../../../../../../electron/types';
import { createAndroidToolchainSection } from './android-toolchain-section';
import { createSettingsControl, createSettingsPanel, type SettingsPanelRow } from '../../../../../shared/ui/settings-panel';
import { renderPageHeader } from '../../../../../shared/ui/page-header';
import { showAlert, showModal } from '../../../../../shared/ui/modal';
import { createButton, type FieldControl } from '../../../../../shared/ui/fields';
import { createFormController } from '../../../../../shared/ui/form-state';
import { createDynamicForm, type DynamicFieldDefinition, type DynamicFormValues } from '../../../../../shared/ui/dynamic-form';
import { createBuildTemplatesPanel } from '../templates';

interface PlatformConfigsOptions { header: HTMLElement; list: HTMLUListElement; project: ProjectConfig; platform: string; onSave(): Promise<void>; onInstallTemplates(missing: string[]): Promise<void>; }
type Values = DynamicFormValues;
interface PanelDefinition { title: string; status?: string; statusClass?: string; rows: Array<{ key: string; title: string; actions?: (control: FieldControl<string>) => HTMLElement }>; }

export function platformHasEditableConfigs(platform: string): boolean { return platform === 'android' || platform === 'ios' || platform === 'fb-instant-games'; }
const configured = (ready: boolean): Pick<PanelDefinition, 'status' | 'statusClass'> => ({ status: ready ? 'Configured' : 'Missing values', statusClass: ready ? 'badge-success' : 'badge-running' });

export async function renderPlatformConfigsRoute(options: PlatformConfigsOptions): Promise<void> {
    renderPageHeader(options.header, { title: 'Configurations', description: 'Manage build and publishing settings for the current platform.', actions: [{ id: 'save-platform-configs-btn', label: 'Save', className: 'btn-primary' }] });
    options.list.innerHTML = '';
    const initialValues: Values = {}; const fields: DynamicFieldDefinition<Values>[] = []; const panels: PanelDefinition[] = []; const apply: Array<(values: Values) => void> = [];
    const add = (key: string, value: string, field: Omit<DynamicFieldDefinition<Values>, 'key'>): void => { initialValues[key] = value; fields.push({ ...field, key }); };
    const profiles = options.project.profiles.filter((profile) => profile.platform === options.platform);

    if (options.platform === 'android' || options.platform === 'ios') {
        const rows = profiles.map((profile) => { const key = `identifier:${profile.id}`; add(key, profile.packageName ?? '', { type: 'text', label: profile.label, placeholder: 'com.company.game' }); apply.push((values) => { profile.packageName = String(values[key] ?? '').trim(); }); return { key, title: profile.label }; });
        panels.push({ title: options.platform === 'ios' ? 'Bundle identifiers' : 'Package names', ...configured(profiles.every((profile) => Boolean(profile.packageName?.trim()))), rows });
    }

    if (options.platform === 'ios') {
        const source = profiles[0]; const rows: PanelDefinition['rows'] = [];
        const addShared = (key: 'iosTeamId' | 'iosApiKeyId' | 'iosApiIssuerId' | 'iosApiKeyPath', title: string, placeholder: string, file = false): void => {
            add(key, source?.[key] ?? '', { type: file ? 'file' : 'text', label: title, placeholder, chooseFile: file ? () => window.buildApi.pickExecutable() : undefined });
            apply.push((values) => { for (const profile of profiles) profile[key] = String(values[key] ?? '').trim() || undefined; }); rows.push({ key, title });
        };
        addShared('iosTeamId', 'Apple Team ID', 'ABCDE12345'); addShared('iosApiKeyId', 'API Key ID', 'ABC123DEFG'); addShared('iosApiIssuerId', 'Issuer ID', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'); addShared('iosApiKeyPath', 'Private key (.p8)', 'Choose AuthKey_…p8', true);
        panels.push({ title: 'Deployment', ...configured(Boolean(source?.iosTeamId && source?.iosApiKeyId && source?.iosApiIssuerId && source?.iosApiKeyPath)), rows });
    }

    if (options.platform === 'android') {
        const source = profiles.find((profile) => !profile.debug) ?? profiles[0]; type Key = 'androidKeystorePath' | 'androidKeystorePassword' | 'androidKeyAlias' | 'androidKeyPassword' | 'androidPlayServiceAccountPath' | 'androidPlayTrack'; const rows: PanelDefinition['rows'] = [];
        const addShared = (key: Key, title: string, placeholder: string, type: 'text' | 'password' | 'file' | 'select' = 'text'): void => {
            add(key, source?.[key] ?? (key === 'androidPlayTrack' ? 'internal' : ''), { type, label: title, placeholder, chooseFile: type === 'file' ? () => window.buildApi.pickExecutable() : undefined, options: type === 'select' ? ['internal', 'alpha', 'beta', 'production'].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })) : undefined });
            apply.push((values) => { for (const profile of profiles) profile[key] = String(values[key] ?? '').trim() || undefined; }); rows.push({ key, title });
        };
        addShared('androidKeystorePath', 'Release keystore', 'Choose .jks or .keystore file', 'file'); addShared('androidKeystorePassword', 'Keystore password', 'Required for release signing', 'password'); addShared('androidKeyAlias', 'Key alias', 'Release key alias'); addShared('androidKeyPassword', 'Key password', 'Required for release signing', 'password'); addShared('androidPlayServiceAccountPath', 'Play service account', 'Choose service-account JSON', 'file'); addShared('androidPlayTrack', 'Google Play track', '', 'select');
        panels.push({ title: 'Deployment', ...configured(Boolean(source?.androidKeystorePath && source.androidKeystorePassword && source.androidKeyAlias && source.androidKeyPassword && source.androidPlayServiceAccountPath)), rows });
    }

    let dynamic: ReturnType<typeof createDynamicForm<Values>>;
    if (options.platform === 'fb-instant-games') {
        const source = profiles[0]; const appIdKey = 'facebookAppId'; const businessIdKey = 'facebookBusinessId'; const tokenKey = 'facebookAppAccessToken';
        add(appIdKey, source?.facebookAppId ?? '', { type: 'text', label: 'App ID', placeholder: 'Facebook App ID' }); add(businessIdKey, source?.facebookBusinessId ?? '', { type: 'text', label: 'Business ID', placeholder: 'Meta Business ID' }); add(tokenKey, source?.facebookAppAccessToken ?? '', { type: 'password', label: 'App access token', placeholder: 'Meta app access token' });
        apply.push((values) => { for (const profile of profiles) { profile.facebookAppId = String(values[appIdKey] ?? '').trim() || undefined; profile.facebookBusinessId = String(values[businessIdKey] ?? '').trim() || undefined; profile.facebookAppAccessToken = String(values[tokenKey] ?? '').trim() || undefined; } });
        panels.push({ title: 'Facebook App', ...configured(Boolean(source?.facebookAppId && source.facebookAppAccessToken)), rows: [{ key: appIdKey, title: 'App ID' }, { key: businessIdKey, title: 'Business ID' }, { key: tokenKey, title: 'App access token', actions: (control) => {
            const wrapper = createSettingsControl(control); const getToken = createButton({ label: 'Get token', className: 'btn-secondary', symbol: 'download' }); wrapper.appendChild(getToken);
            getToken.addEventListener('click', () => {
                const appId = String(dynamic.values[appIdKey] ?? '').trim(); if (!appId) { showAlert('Enter the Facebook App ID first.', 'App ID required', 'warning'); dynamic.getControl(appIdKey)?.focus?.(); return; }
                const secretForm = createDynamicForm({ initialValues: { secret: '' }, fields: [{ key: 'secret', type: 'password', label: 'Facebook App Secret', placeholder: 'Facebook App Secret', required: true }] });
                const content = document.createElement('div'); content.className = 'token-secret-form'; const explanation = document.createElement('p'); explanation.textContent = 'Enter the App Secret once. It will be sent directly to Meta to request a new app access token and will not be saved.'; content.append(explanation, secretForm.element);
                showModal({ title: 'Get app access token', icon: 'settings', content, onClose: () => secretForm.reset({ secret: '' }), actions: [{ label: 'Cancel', run: (close) => close() }, { label: 'Get token', className: 'btn-primary', run: (close) => { const secret = String(secretForm.values.secret).trim(); if (!secret) { secretForm.validate(); return; } close(); void window.buildApi.getFacebookAppAccessToken(appId, secret).then((token) => { dynamic.setValue(tokenKey, token); showAlert('The app access token is ready. Save configurations to keep it.', 'Token generated'); }).catch((error) => showAlert(error instanceof Error ? error.message : String(error), 'Could not get token', 'warning')); } }] });
            }); return wrapper;
        } }] });
    }

    dynamic = createDynamicForm({ initialValues, fields });
    for (const panel of panels) {
        const rows: SettingsPanelRow[] = panel.rows.map((row) => { const control = dynamic.getControl(row.key) as FieldControl<string>; return { title: row.title, actions: row.actions ? row.actions(control) : createSettingsControl(control) }; });
        options.list.appendChild(createSettingsPanel({ title: panel.title, status: panel.status, statusClass: panel.statusClass, rows }));
    }
    if (options.platform === 'android') { const status = await window.buildApi.getAndroidToolchainStatus(options.project.projectPath); options.list.appendChild(createAndroidToolchainSection(options.project, status)); }
    try {
        const templateStatus = await window.buildApi.getBuildTemplateStatus(options.project.projectPath, options.platform);
        options.list.appendChild(createBuildTemplatesPanel(templateStatus, options.onInstallTemplates));
    } catch (error) {
        console.error('[build-dashboard] Could not inspect build templates.', error);
    }
    const save = options.header.querySelector<HTMLButtonElement>('#save-platform-configs-btn'); if (!save) return; save.hidden = fields.length === 0; if (!fields.length) return;
    const form = createFormController({ read: () => dynamic.values, saveButton: save, save: async (values) => { apply.forEach((commit) => commit(values)); await options.onSave(); await renderPlatformConfigsRoute(options); } }); dynamic.onChange(() => form.changed());
}
