# 바른 글씨 Android TWA 소스

기존 https://spelling-checker-eight.vercel.app/ 를 여는 최소 Android 래퍼입니다. 패키지 ID는 com.jeongwonhee.bareungeulssi입니다. 이 프로젝트는 게시되거나 실기기에서 검증된 릴리스가 아닙니다.

## 도구와 로컬 빌드

- JDK 17, Gradle 8.13, Android Gradle Plugin 8.13.0, Android SDK Platform 36 및 Build Tools 35.0.0이 필요합니다. minSdk 23, targetSdk/compileSdk 36입니다.
- 프로젝트에는 Gradle Wrapper가 포함되지 않습니다. 신뢰할 수 있는 경로로 설치한 Gradle 8.13을 사용하세요. Android SDK의 설치 및 약관 수락은 사용자가 직접 처리해야 합니다. 이 프로젝트와 워크플로는 sdkmanager나 약관 수락 명령을 실행하지 않고 SDK 자동 다운로드를 끕니다. 필요한 구성 요소가 없으면 중단됩니다.
- 프로젝트 폴더에서 `gradle --no-daemon bundleRelease assembleRelease`를 실행하세요. 기본 release AAB와 APK는 미서명입니다. 미서명 APK는 그대로 설치할 수 없고 미서명 AAB는 Play에 업로드할 수 없습니다. 결과물은 app/build/outputs/ 아래에 생성됩니다.
- 디버그 빌드/실기기 테스트를 실행하면 Android 도구가 별도의 디버그 서명키를 만들 수 있습니다. 이 키를 저장소에 넣지 마세요.

## GitHub Actions 및 서명 키 관리

앱 소스는 저장소의 `android/` 아래로 배치하고, `.github/workflows/android-build.yml`은 저장소 루트의 같은 경로로 배치해야 합니다. 워크플로는 그 배치를 전제로 합니다. 현재 파일은 로컬 준비용이며 저장소에 올리지 않았습니다. 수동 workflow_dispatch 전용입니다. 미리 설치된 API 36 및 build-tools 35.0.0이 없으면 설치나 약관 수락 없이 실패합니다.

워크플로의 서명 분기 순서:

1. `BAREUN_UPLOAD_KEYSTORE`와 `BAREUN_UPLOAD_PASSWORD` secret이 둘 다 있으면 해당 기존 키를 사용합니다. 하나만 있으면 실패합니다. keystore secret은 전체 파일의 Base64 문자열이며, alias는 `upload`, keystore와 개인키 암호는 동일해야 합니다.
2. 두 secret이 없고 `android/signing-recipient.pem` 공개키가 있으면 임시 러너에서 RSA 3072 업로드 JKS와 무작위 암호를 생성해 릴리스에 서명합니다. 별도의 무작위 래핑 암호로 JKS와 암호 텍스트를 담은 tar를 AES-256-CBC, PBKDF2 200000회로 암호화하고, 래핑 암호는 공개키로 RSA-OAEP SHA-256 및 MGF1 SHA-256 암호화합니다. 암호는 생성 직후 로그 마스킹하며 평문 파일은 임시 디렉터리에만 두고 종료 트랩으로 지웁니다.
3. secret과 공개키가 모두 없으면 미서명 AAB/APK만 만듭니다. 이 결과물은 설치 또는 Play 업로드용이 아닙니다.

최초 생성 전에 부모 작업자가 신뢰할 수 있는 RSA 공개키만 `android/signing-recipient.pem`에 제공해야 합니다. 대응 개인키는 저장소와 Actions 아티팩트 밖의 안전한 장소에 별도로 보관하고, 공개키가 올바른 개인키와 짝인지 미리 확인하세요. 최초 생성 시 암호화 백업 업로드가 성공한 뒤에만 서명된 앱을 업로드합니다. 다음 실행 전에 기존 키를 secret으로 등록하지 않으면 새 키가 다시 생성되므로 주의하세요. Gradle 캐시는 비활성화했습니다. 서명된 AAB/APK 외에는 암호화된 `signing-backup.tar.enc`와 `wrapping-key.enc`만 명시적으로 업로드합니다. 공개 저장소에서는 암호화된 백업도 공개될 수 있습니다. 개인키 분실 시 업로드 키를 복구할 수 없으며 CBC 암호화 자체에는 위변조 인증이 없으므로 아티팩트의 출처와 무결성을 별도로 검증하고 안전하게 보관하세요.

### 개인 환경에서 복구

신뢰할 수 있는 안전한 환경에서 개인키와 두 암호화 파일을 준비하고, 명령 이력과 화면 출력에 암호가 남지 않게 주의하세요. 다음은 OpenSSL 3 기준 예시입니다. 파일 경로는 환경에 맞게 바꾸고 작업 디렉터리는 소유자만 접근하도록 제한하세요.

```sh
umask 077
openssl pkeyutl -decrypt -inkey /private/location/recipient-private.pem \
  -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 \
  -pkeyopt rsa_mgf1_md:sha256 -in wrapping-key.enc -out wrap-password.txt
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass file:wrap-password.txt -in signing-backup.tar.enc -out signing-backup.tar
# 신뢰하는 백업인지 확인한 뒤 제한된 폴더에 압축 해제
tar -xf signing-backup.tar
```

복구된 `upload.jks`의 Base64 전체를 `BAREUN_UPLOAD_KEYSTORE`에, `password.txt` 내용을 `BAREUN_UPLOAD_PASSWORD`에 GitHub Actions secret으로 안전하게 등록합니다. 비밀번호나 Base64를 화면 또는 로그에 표시하지 마세요. 등록과 복구 검증 후 평문 tar, 래핑 암호, 복구 사본은 안전한 절차에 따라 정리하세요. 원본 키와 개인키는 사용자의 안전한 백업 정책에 따라 별도로 보관하세요. 이후 같은 두 secret을 사용해야 앱 업데이트에 필요한 업로드 키가 유지됩니다. 이미 Play에 등록한 키가 있다면 임의로 새 키를 생성하지 마세요.

로컬 서명은 `BAREUN_SIGN=true`, `BAREUN_KEYSTORE_PATH`, `BAREUN_UPLOAD_PASSWORD` 환경 변수로 선택하며 위의 alias와 암호 조건이 동일합니다. 인증서 지문 확인 시 비밀번호를 명령행 인자로 노출하지 마세요.
## Digital Asset Links

앱 측 asset_statements는 대상 웹 출처를 선언합니다. 사이트의 `https://spelling-checker-eight.vercel.app/.well-known/assetlinks.json`은 2026-11-23 확인 시 404였습니다. 이 프로젝트는 사이트를 수정하거나 배포하지 않습니다. 사이트 측에는 HTTPS에서 리디렉션 없이 JSON으로 다음 형태를 제공해야 합니다. 아래는 형식만 보여 주며 인증서 지문은 실제 값이 아닙니다.

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.jeongwonhee.bareungeulssi",
    "sha256_cert_fingerprints": ["실제_서명_인증서_SHA256_지문"]
  }
}]
```

설치된 앱에 실제로 서명한 인증서의 SHA-256 지문을 사용하세요. Play App Signing을 사용하면 Play에서 설치되는 앱은 업로드 키가 아닌 Play 앱 서명 인증서 지문이 필요합니다. 직접 설치용 업로드 키 및 테스트용 디버그 인증서 지문은 각각 다를 수 있습니다. 필요한 것만 추가하고 Android App Links와 브라우저 TWA 검증을 실제 기기에서 확인하세요.

검증이 되지 않으면 지원 브라우저는 보통 주소 표시줄을 보여 주며, TWA 미지원 환경에서는 라이브러리 기본 Custom Tabs 대체 경로를 사용합니다. 적절한 브라우저가 없는 기기에서는 일반 브라우저 실행 또는 실패 가능성도 확인해야 합니다. 웹뷰를 별도로 추가하지 않았습니다.

## 아이콘 및 확인할 테스트

매니페스트에서 확인한 /icons/icon-192.png와 /icons/icon-512.png를 각각 런처 아이콘과 로딩 스플래시에 그대로 사용했습니다. 웹 manifest의 색상도 반영했습니다. Android 앱은 방향을 강제하지 않지만 기존 웹 manifest에는 portrait 설정이 있어 브라우저 동작이 다를 수 있습니다.

- 최초 빌드 및 병합된 AndroidManifest의 권한과 exported/provider 설정 확인
- Android 6 이상과 최신 Android, 지원 Chrome 및 대체 브라우저에서 시작/종료/뒤로 가기/외부 링크 확인
- 스플래시 아이콘, 런처 아이콘, 화면 회전 및 세로 방향 설정 확인
- 실제 서명 앱에서 assetlinks 배포 전 주소 표시줄 표시, 배포 후 검증과 주소 표시줄 제거 확인
- 네트워크 끊김 및 복구, PWA의 입력/음성 입력 등 기능과 권한 동작 확인
- 서명된 테스트 APK와 Play 테스트 트랙의 앱 서명 및 업데이트 가능 여부 확인

현재 소스 생성과 정적 XML 검사만 수행했으며, 실제 Gradle 빌드, CI, 서명, 기기 테스트, Play 업로드 또는 웹 배포는 수행하지 않았습니다.
