FROM node:20

# Set working directory
WORKDIR /app

# Install expo-cli globally
RUN npm install -g expo-cli

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the project
COPY . .

# Expose Expo ports
EXPOSE 19000 19001 19002

# Run Expo
CMD ["npx", "expo", "start", "--tunnel"]
