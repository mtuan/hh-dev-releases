#import <Foundation/Foundation.h>
#import <Security/Security.h>
#include <sys/stat.h>

static void fail(NSString *message, int code) {
    fprintf(stderr, "%s\n", message.UTF8String);
    exit(code);
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 3) fail(@"Usage: export-identity <certificate-common-name> <output.p12>", 64);
        NSString *targetName = [NSString stringWithUTF8String:argv[1]];
        NSString *outputPath = [NSString stringWithUTF8String:argv[2]];
        NSData *passwordData = [[NSFileHandle fileHandleWithStandardInput] readDataToEndOfFile];
        NSString *password = [[NSString alloc] initWithData:passwordData encoding:NSUTF8StringEncoding];
        if (!password.length) fail(@"The PKCS#12 password was not provided on standard input.", 64);
        NSDictionary *query = @{
            (__bridge id)kSecClass: (__bridge id)kSecClassIdentity,
            (__bridge id)kSecMatchLimit: (__bridge id)kSecMatchLimitAll,
            (__bridge id)kSecReturnRef: @YES,
        };
        CFTypeRef result = NULL;
        OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
        if (status != errSecSuccess) fail([NSString stringWithFormat:@"Could not read Keychain identities (status %d).", (int)status], 65);
        NSArray *identities = CFBridgingRelease(result);
        SecIdentityRef selected = NULL;
        for (id value in identities) {
            SecIdentityRef identity = (__bridge SecIdentityRef)value;
            SecCertificateRef certificate = NULL;
            if (SecIdentityCopyCertificate(identity, &certificate) != errSecSuccess) continue;
            CFStringRef commonName = NULL;
            SecCertificateCopyCommonName(certificate, &commonName);
            BOOL matches = commonName && [(__bridge NSString *)commonName isEqualToString:targetName];
            if (commonName) CFRelease(commonName);
            CFRelease(certificate);
            if (matches) { selected = identity; break; }
        }
        if (!selected) fail([NSString stringWithFormat:@"Identity not found: %@", targetName], 66);
        SecItemImportExportKeyParameters parameters = {0};
        parameters.version = SEC_KEY_IMPORT_EXPORT_PARAMS_VERSION;
        parameters.passphrase = (__bridge CFTypeRef)password;
        parameters.alertTitle = CFSTR("Cocos Build Dashboard signing export");
        parameters.alertPrompt = (__bridge CFStringRef)[NSString stringWithFormat:@"Approve export of %@.", targetName];
        CFDataRef exported = NULL;
        status = SecItemExport(selected, kSecFormatPKCS12, 0, &parameters, &exported);
        if (status != errSecSuccess) fail([NSString stringWithFormat:@"Could not export the selected identity (status %d).", (int)status], 67);
        NSData *data = CFBridgingRelease(exported);
        NSError *error = nil;
        if (![data writeToFile:outputPath options:NSDataWritingAtomic error:&error]) fail([NSString stringWithFormat:@"Could not write the PKCS#12 archive: %@", error.localizedDescription], 68);
        chmod(outputPath.fileSystemRepresentation, S_IRUSR | S_IWUSR);
        fprintf(stdout, "Exported %s\n", targetName.UTF8String);
    }
    return 0;
}
