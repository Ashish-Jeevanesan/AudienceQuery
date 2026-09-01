# Stage 1: Build the application
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production=false

# Copy the rest of the application source code
COPY . .

# Build the frontend and backend
# This script first builds the vite app, then compiles the server
RUN npm run build


# Stage 2: Create the production image
FROM node:20-slim

WORKDIR /app

# Copy production dependencies from the builder stage
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm install --production=true

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Command to start the server
CMD ["npm", "run", "start"]
