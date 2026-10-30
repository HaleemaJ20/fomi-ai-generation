# Fomi - AI Image/Video Generation Web App

## Overview
Fomi is an AI-powered web application designed for generating images and videos. The application leverages advanced algorithms to create stunning visuals based on user inputs. This project is built using Next.js and styled with Tailwind CSS, ensuring a responsive and modern user experience.

## Features
- **Image/Video Generation**: Users can generate images and videos based on customizable options.
- **History Tracking**: A history feature allows users to view previously generated content.
- **Theme Toggle**: Users can switch between light and dark themes for a personalized experience.
- **Responsive Design**: The application is fully responsive, providing a seamless experience across devices.

## Getting Started

### Prerequisites
- Node.js (version 14 or later)
- npm or yarn

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd fomi-assessment
   ```

2. Install dependencies:
   ```
   npm install
   ```
   or
   ```
   yarn install
   ```

3. Start the development server:
   ```
   npm run dev
   ```
   or
   ```
   yarn dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

### Project Structure
```
fomi-assessment
├── src
│   ├── app
│   │   ├── api
│   │   ├── globals.css
│   │   ├── layout.js
│   │   └── page.js
│   ├── components
│   │   ├── generation
│   │   ├── history
│   │   ├── layout
│   │   ├── providers
│   │   ├── results
│   │   └── ui
│   ├── context
│   ├── hooks
│   ├── lib
│   └── data
├── .eslintrc.json
├── .gitignore
├── .env.example
├── jsconfig.json
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.js
└── public
```

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.