FROM node:22-alpine

WORKDIR /app

# Install build dependencies for sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the frontend
RUN npm run build

# Install tsx globally to run the server
RUN npm install -g tsx

# Set environment variables
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start the server
CMD ["tsx", "server.ts"]
