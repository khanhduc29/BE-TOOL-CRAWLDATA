# ✅ Playwright official image (đã có Chromium + system deps)
FROM mcr.microsoft.com/playwright:v1.58.0-jammy

# Set working directory
WORKDIR /app

# Copy package files trước để cache dependency
COPY package*.json ./

# Install node dependencies
RUN npm install

# Copy toàn bộ source code
COPY . .

# Build TypeScript -> dist
RUN npm run build

# Environment
ENV NODE_ENV=production

# Render dùng CMD, không cần expose port vì là bot
CMD ["npm", "start"]