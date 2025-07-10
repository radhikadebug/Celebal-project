# Use Node.js LTS version
FROM node:18

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Expose port (make sure it's same as server uses)
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]

