FROM node:18-slim

# Install dependencies for Puppeteer and apkeep
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install apkeep (APK downloader tool)
RUN wget -q https://github.com/EFForg/apkeep/releases/latest/download/apkeep-x86_64-unknown-linux-musl -O /usr/local/bin/apkeep && \
    chmod +x /usr/local/bin/apkeep

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app files
COPY . .

# Expose port
EXPOSE 3000

# Start the service
CMD ["node", "server.js"]

