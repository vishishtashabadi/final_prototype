# Use a node image for building the app
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the production bundle
RUN npm run build

# Use nginx to serve the built static files
FROM nginx:stable-alpine

# Copy the build output to nginx html folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy a custom nginx config if needed (optional)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
