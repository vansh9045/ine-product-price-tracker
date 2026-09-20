# Use official Playwright image which includes Node.js and browser dependencies
# This ensures Chromium is available in the container without needing root runtime installs.
FROM mcr.microsoft.com/playwright:latest

# Create app directory
WORKDIR /usr/src/app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application source (do NOT copy secrets like .env into the image)
COPY . .

# Ensure environment defaults are set; Render will override PORT via env
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Start the application using the existing package.json start script
CMD ["npm", "start"]
