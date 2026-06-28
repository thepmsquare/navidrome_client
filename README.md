# navidrome_client

a client for navidrome server for android platform.

## getting started

this project is a starting point for a flutter application that connects to a navidrome server.

### prerequisites

- flutter sdk
- dart sdk

### installation

1. clone the repository:
   ```bash
   git clone https://github.com/thepmsquare/navidrome_client.git
   ```
2. install dependencies:
   ```bash
   flutter pub get
   ```
3. configure environment (optional):
   copy `.env.example` to `.env` and fill in the `SENTRY_DSN` if you want to enable Sentry:
   ```bash
   cp .env.example .env
   ```
4. run the application:
   ```bash
   flutter run --dart-define-from-file=.env
   ```

### building the application

you can build the APK or App Bundle using the environment file:

- **apk**:
  ```bash
  flutter build apk --dart-define-from-file=.env
  ```
- **appbundle**:
  ```bash
  flutter build appbundle --dart-define-from-file=.env
  ```

## license

this project is licensed under the gnu general public license v3. see the [license](LICENSE) file for details.
