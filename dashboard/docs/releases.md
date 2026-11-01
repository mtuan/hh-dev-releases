# Dashboard releases

All dashboard release work is performed from the local-only **Deploy** section. Developers do not create tags, run packaging commands, upload artifacts, or edit CI secrets manually.

## 1. Create the release-control repository

Create a new GitHub repository with these recommended values:

- **Owner:** the user or organization that owns developer-tool releases.
- **Repository name:** `cocos-build-dashboard-releases` or a company-specific name such as `hh-dev-releases`.
- **Description:** `Signed Cocos Build Dashboard releases and production update control.`
- **Visibility:** Private is recommended. Use Public only when anyone should download first-install packages from GitHub without authentication.
- **Add README:** Off.
- **Add .gitignore:** `No .gitignore`.
- **License:** `No license`, unless company policy requires one.

Create the repository and clone it beside the game project. For example:

```text
Projects/
  TemplateCocosV3/
  hh-dev-releases/
```

Use SSH or Git Credential Manager so normal pushes work without repeatedly entering credentials. When a GitHub token is entered or `gh auth login` has authenticated the GitHub CLI, saving automatically enables Actions, allows all actions and reusable workflows, disables full-SHA pinning for the generated `@v4` workflow, sets workflow permissions to read/write, disables pull-request approval, and synchronizes Actions secrets. Other repository Actions settings are unrelated and remain unchanged. If neither credential is available, verify those values manually in **Settings → Actions → General**.

## 2. Configure repository automation

Create a dedicated public GitHub repository for dashboard releases and clone it beside the game project. Open **Deploy → Configurations**, choose that local repository, and configure macOS signing/notarization, Windows signing, or both. The dashboard can also auto-detect a previously configured sibling repository.

Saving makes the repository public, installs the release-control marker and GitHub Actions workflow, commits them, and pushes them with the machine’s existing Git authentication. A GitHub token is optional because an authenticated `gh` session can configure repository visibility, Actions permissions, and secrets instead. Neither credential is embedded in released applications.

Use these field values:

- **Local release repository:** the cloned repository root containing `.git`, for example `/Applications/Developments/HayHay/Projects/hh-dev-releases`.
- **GitHub repository:** read-only and detected from `origin`, for example `mtuan/hh-dev-releases`.
- **Release branch:** `main` for a new repository.
- **GitHub token:** optional; leave it blank to use the authenticated `gh` session. If supplied, use a fine-grained token restricted to the release repository with Actions, Secrets, and Administration read/write access. The credential configures repository automation and secrets; Git authentication still handles pushes.

## 3. Configure update hosting

GitHub Releases hosts both first-install packages and automatic updates. The URL is derived from the selected repository and requires no additional hosting fields or credentials. Creating a build publishes an immutable Release; **Roll to production** marks the selected Release as latest. Because the repository is public, installed dashboards download updates anonymously without storing a GitHub token.

## 4. Configure macOS signing and notarization

- Use the lock action in the **macOS signing & notarization** panel. The dashboard detects installed **Developer ID Application** identities, selects the Apple team, creates a strong export password, exports and validates an encrypted `.p12`, fills the certificate fields, and uploads both certificate secrets when GitHub authentication is available.
- If no identity exists, sign into Xcode with an Account Holder account and use **Xcode → Settings → Accounts → Manage Certificates** to create the Developer ID Application certificate. Apple requires this one-time manual step. Return to the dashboard and choose **Check again**; do not export the certificate manually.
- Approve the normal macOS Keychain access prompt if it appears during private-key export.
- Use an Apple ID belonging to the same developer team.
- At account.apple.com, open **Sign-In and Security → App-Specific Passwords**, generate one with the label **Cocos Build Dashboard GitHub Actions**, and paste Apple’s generated password into the dashboard. The label is only for recognizing the credential; never enter the normal Apple ID or Mac login password.
- Copy the 10-character Team ID from Apple Developer Membership details.

These become `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` Actions secrets.

## 5. Configure Windows signing

- Obtain an Authenticode code-signing certificate and export it with its private key as `.pfx` or `.p12`.
- Enter the certificate export password.
- Enter the publisher exactly as the certificate Subject/Common Name, including punctuation and company suffixes.

These become `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, and `WINDOWS_PUBLISHER_NAME` Actions secrets.

## 6. Build a platform version

1. Open **Deploy → Builds** and choose **New build**.
2. Select one configured platform, enter a semantic version, and choose Stable or Beta.
3. The dashboard snapshots its source and pushes one platform-specific build request. GitHub Actions builds and uploads only that platform. macOS and Windows artifacts for the same version share one GitHub Release, so rebuilding Windows does not rebuild or replace working macOS artifacts, and vice versa.
4. When the build is ready, choose **Roll to production**.

Use Patch for compatible fixes, Minor for backward-compatible features, and Major for breaking changes. Stable is a production candidate; Beta is for developer testing. A platform build may be retried and republished without changing the other platform. Creating a build does not affect installed applications until that version is explicitly rolled to production.

## 7. Promote or roll back

Open **Deploy → Builds** and choose **Roll to production** on an older build. The dashboard commits and pushes the selected production pointer. GitHub Actions republishes that build’s installers and update metadata, so a faulty production release can be reversed without creating another build.

GitHub Releases remains the first-install download location. Installed applications subsequently check the configured production update feed and install signed releases automatically according to their update preferences.

## 8. Install and update developer machines

Share the macOS DMG or Windows EXE attached to the selected GitHub Release. Private repositories require authorized GitHub access for the first download. Once installed, the dashboard checks the public update URL, so developers do not need GitHub credentials for automatic updates. Keep that URL stable and never mutate an existing version; create a new patch build for fixes.
