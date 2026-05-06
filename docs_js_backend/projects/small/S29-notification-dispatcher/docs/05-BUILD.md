# 05-BUILD

## Step-by-Step

1. **Initialize project**
   ```bash
   npm init -y
   npm install express@5 nodemailer twilio firebase-admin ws ioredis helmet
   npm install -D typescript @types/express @types/nodemailer @types/ws @types/node supertest @types/supertest vitest tsx
   npx tsc --init
   ```

2. **Configure TypeScript ESM**
   Set `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`.

3. **Create channel adapters**
   - `src/services/channels/email.ts`: Nodemailer stub.
   - `src/services/channels/sms.ts`: Twilio stub.
   - `src/services/channels/push.ts`: FCM stub.
   - `src/services/channels/websocket.ts`: Redis publish stub.

4. **Create template service**
   - `src/services/templates.ts`: Simple variable substitution.

5. **Create preference service**
   - `src/services/preferences.ts`: In-memory store (use Redis/DB in production).

6. **Create dispatcher**
   - `src/services/dispatcher.ts`: Fan-out to channels. Bug: ignores preferences.

7. **Create controller**
   - `src/controller.ts`: `sendNotification`, `getPreferences`, `updatePreferences`.

8. **Wire routes**
   - `src/routes.ts`: POST `/notify`, GET `/preferences/:userId`, PUT `/preferences/:userId`.

9. **Create app entry**
   - `src/index.ts`: Express with JSON and helmet.

10. **Write tests**
    - `tests/dispatcher.test.ts`: Send notification, preference opt-out bug reproduction.

11. **Add Docker**
    - `docker-compose.yml`: Redis and Mailpit.
