# Use an official Node.js runtime environment
FROM node:18-alpine

# Set the active working directory inside the container
WORKDIR /app

COPY package*.json ./
RUN npm install --production

# Copy the rest of your application code into the container
COPY . .

# Expose the network port your Node server uses (usually 3000 or 8080)
EXPOSE 7860

# Set the environment port variable to match Hugging Face's requirements
ENV PORT=7860

# Launch your backend server
CMD ["node", "backend/server.js"]
