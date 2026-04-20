FROM node:20

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Install Playwright Chromium and its Linux Operating System dependencies
RUN npx playwright install --with-deps chromium

# Start the stealth bot
CMD ["npm", "start"]
