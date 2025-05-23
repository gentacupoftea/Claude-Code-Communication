FROM node:18-alpine

WORKDIR /app

# Install basic dependencies
RUN apk add --no-cache curl

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code
COPY . .

# Create necessary directories
RUN mkdir -p data logs

# Expose port
EXPOSE 8000

# Set environment
ENV NODE_ENV=production
ENV PORT=8000

# Simple start command
CMD ["node", "server.js"]
EOF < /dev/null