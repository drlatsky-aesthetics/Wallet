# Certificate Files

Upload your Apple certificate files here for conversion.

## Expected files

- `AppleWWDRCAG4.cer` — Apple WWDR G4 intermediate cert (download from apple.com/certificateauthority)
- `cert.p12` — Your Pass Type ID signing cert exported from Keychain

## Important

These files are for temporary conversion only. **Never commit real `.p12` files or private keys to git.**
Delete them from the repo after you have extracted the base64 env var values.
