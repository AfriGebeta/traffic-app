# Contributing to Traffic App

Thanks for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- Android Studio (for Android development) or Xcode (for iOS development)
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/traffic-app.git
   cd traffic-app
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a `.env` file in the root directory with the following variables:
   ```
   EXPO_PUBLIC_GEBETA_API_KEY=your_gebeta_api_key_here - you can get it by registering to https://gebeta.app

   EXPO_PUBLIC_API_URL=your_backend_api_url_here
   ```

5. Start the development server:
   ```bash
   npx expo start
   ```

6. Run on Android device (via USB cable):
   ```bash
   npx expo run:android
   ```
   Make sure your Android device is connected via USB with USB debugging enabled, or use an Android emulator.

## Project Structure

```
src/
├── app/              # Expo Router screens
├── components/       # Reusable UI components
├── modules/          # Feature modules
│   ├── explore/      # Explore & discovery
│   ├── incidents/    # Incident reporting
│   ├── leaderboard/  # User rankings & gamification
│   ├── navigation/   # Navigation & tracking
│   ├── map/          # Map components
│   ├── places/       # Places management
│   ├── profile/      # User profile
│   └── register/     # User registration
├── shared/           # Shared utilities
│   ├── components/   # Shared components
│   ├── contexts/     # React contexts
│   ├── hooks/        # Custom hooks
│   ├── services/     # API services
│   └── utils/        # Utility functions
```

## Development Workflow

### Branching Strategy

- `main` - Production-ready code
- `dev` - Development branch
- `feat/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Making Changes

1. Create a new branch from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the code style guidelines

3. Test your changes thoroughly

4. Commit your changes with clear messages:
   ```bash
   git commit -m "feat: add incident photo upload"
   ```

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Open a Pull Request against the `develop` branch

## Code Style

- Follow the existing code style
- Use TypeScript for type safety
- Use functional components and hooks
- Keep components small and focused
- Use meaningful variable and function names
- Add comments for complex logic


## Commit Messages

Follow conventional commits format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example: `feat: add voice navigation support`

## Pull Request Guidelines

- Fill out the PR template completely
- Link related issues
- Ensure all tests pass
- Update documentation if needed
- Keep PRs focused on a single feature or fix
- Request review from maintainers

## Testing

Before submitting a PR:

1. Test on both Android and iOS if possible
2. Verify no TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```
3. Run linting:
   ```bash
   npm run lint
   ```

## Reporting Issues

When reporting bugs, include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Device/OS information
- Screenshots if applicable
- Relevant logs

## Feature Requests

For feature requests:

- Describe the feature clearly
- Explain the use case
- Provide examples if possible
- Discuss potential implementation approaches

## Questions?

Feel free to open an issue for questions or reach out to the gebeta maps telegram group.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
