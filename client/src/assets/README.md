# Glucon authentication background

The selected, user-supplied image is stored at:

`client/public/images/glucon-auth-background.png`

Login and registration use the public URL `/images/glucon-auth-background.png` directly in `client/src/styles.css`. No image import or copy in `src/assets` is needed. Vite serves the public file during development and copies it unchanged to `client/dist/images/glucon-auth-background.png` during production builds.

The authentication-only background fills the viewport with centered, non-repeating cover sizing. The form card stays white. Dashboard backgrounds and authentication behavior are unchanged.

Keep the supplied image intact. Build with `npm --prefix client run build`; visually check login and registration at desktop and mobile sizes when browser access is available.
