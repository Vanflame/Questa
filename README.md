# 🎮 Questa - Gaming Quest Platform

[![GitHub Pages](https://img.shields.io/badge/Deployed%20on-GitHub%20Pages-blue?logo=github)](https://your-username.github.io/your-repo-name)
[![Firebase](https://img.shields.io/badge/Powered%20by-Firebase-orange?logo=firebase)](https://firebase.google.com)
[![Supabase](https://img.shields.io/badge/Powered%20by-Supabase-green?logo=supabase)](https://supabase.com)

> **Earn real money by completing gaming quests and tasks!** Questa is a modern web platform that connects gamers with rewarding quest opportunities, allowing users to monetize their gaming skills through verified task completion.

## 🌟 Features

### 🎯 **Quest System**
- **Multiple Quest Types**: Gaming tasks, social media challenges, and app-based activities
- **Real-time Progress Tracking**: Live countdown timers and progress indicators
- **Quest Verification**: Two-phase verification system with admin approval
- **Dynamic Rewards**: Variable payout system based on quest difficulty and completion

### 👤 **User Management**
- **Secure Authentication**: Firebase Auth with Google OAuth integration
- **Profile Management**: User profiles with gaming statistics and earnings history
- **Wallet System**: Real-time balance tracking and transaction history
- **Quest History**: Complete record of completed and attempted quests

### 🔧 **Admin Panel**
- **Quest Management**: Create, edit, and manage gaming quests
- **User Oversight**: Monitor user activity and quest completions
- **Real-time Timers**: Live monitoring of user quest progress
- **Verification System**: Approve or reject quest submissions
- **Analytics Dashboard**: Comprehensive statistics and insights

### 🎨 **Modern UI/UX**
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Dark/Light Theme**: Modern interface with smooth animations
- **Intuitive Navigation**: Clean, user-friendly interface
- **Real-time Updates**: Live notifications and status updates

## 🚀 Live Demo

**🔗 [Try Questa Now](https://your-username.github.io/your-repo-name)**

### Demo Accounts
- **User Account**: `demo@questa.com` / `demo123`
- **Admin Account**: `admin@questa.com` / `admin123`

## 🛠️ Technology Stack

### **Frontend**
- **HTML5** - Semantic markup and modern web standards
- **CSS3** - Advanced styling with Flexbox and Grid
- **Vanilla JavaScript** - No framework dependencies for optimal performance
- **Font Awesome** - Professional icon library
- **Google Fonts** - Modern typography

### **Backend & Database**
- **Firebase Authentication** - Secure user management
- **Cloud Firestore** - NoSQL database for real-time data
- **Firebase Storage** - File upload and management
- **Supabase** - Additional backend services and storage

### **Deployment**
- **GitHub Pages** - Free hosting with custom domains
- **Pretty URLs** - SEO-friendly routing structure
- **CDN Integration** - Fast asset delivery

## 📁 Project Structure

```
questa/
├── 📄 index.html                 # Main entry point
├── 📁 login/                     # Authentication pages
│   └── index.html
├── 📁 register/
│   └── index.html
├── 📁 dashboard/                 # User dashboard
│   └── index.html
├── 📁 admin/                     # Admin panel
│   └── index.html
└── 📁 assets/                    # Organized assets
    ├── 📁 css/
    │   └── styles.css           # Main stylesheet
    ├── 📁 js/
    │   ├── auth.js              # Authentication logic
    │   ├── dashboard-handler.js # Dashboard functionality
    │   ├── admin-handler.js     # Admin panel logic
    │   ├── firestore.js         # Database operations
    │   └── ...                  # Additional modules
    └── 📁 images/
        └── logo.png             # Brand assets
```

## 🚀 Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Firebase project setup
- Supabase account (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/questa.git
   cd questa
   ```

2. **Configure Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication (Google provider)
   - Enable Firestore Database
   - Update `assets/js/firebase-config.js` with your config

3. **Configure Supabase** (Optional)
   - Create a Supabase project at [Supabase](https://supabase.com)
   - Update `assets/js/supabase-config.js` with your credentials

4. **Deploy to GitHub Pages**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

5. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Select source branch (usually `main`)
   - Your site will be available at `https://your-username.github.io/your-repo-name`

## 🎮 How It Works

### For Users
1. **Register/Login** - Create account with Google or email
2. **Browse Quests** - View available gaming tasks and rewards
3. **Start Quest** - Begin a quest and start the timer
4. **Complete Task** - Follow quest instructions and requirements
5. **Submit Proof** - Upload screenshots or proof of completion
6. **Get Rewarded** - Receive payment after admin verification

### For Admins
1. **Create Quests** - Design new gaming challenges and tasks
2. **Monitor Progress** - Track user activity and quest completion
3. **Verify Submissions** - Review and approve quest completions
4. **Manage Users** - Oversee user accounts and resolve issues
5. **Analytics** - View platform statistics and performance metrics

## 🔧 Configuration

### Firebase Setup
```javascript
// assets/js/firebase-config.js
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### Environment Variables
Create a `.env` file (not included in repo for security):
```
FIREBASE_API_KEY=your_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

## 🎯 Quest Types

### 🎮 Gaming Quests
- **Mobile Games**: Complete levels, achieve scores, unlock achievements
- **PC Games**: Reach milestones, complete challenges, collect items
- **Console Games**: Platform-specific tasks and objectives

### 📱 App-Based Quests
- **Social Media**: Follow, like, share, and engage with content
- **New Apps**: Download, register, and explore new applications
- **Survey Apps**: Complete questionnaires and provide feedback

### 🌐 Web-Based Tasks
- **Website Testing**: Navigate and test new web applications
- **Content Creation**: Create posts, reviews, and user-generated content
- **Data Entry**: Input information and validate data accuracy

## 📊 Admin Features

### Quest Management
- **Create Quests**: Design custom gaming challenges
- **Set Rewards**: Configure payout amounts and conditions
- **Time Limits**: Set completion deadlines and user time limits
- **Difficulty Levels**: Categorize quests by complexity

### User Monitoring
- **Real-time Timers**: Live tracking of user quest progress
- **Activity Logs**: Complete user action history
- **Performance Metrics**: Success rates and completion statistics
- **Account Management**: User status and balance oversight

### Verification System
- **Two-Phase Review**: Initial and final verification stages
- **Proof Validation**: Screenshot and evidence verification
- **Auto-Approval**: Smart approval for verified patterns
- **Manual Override**: Admin intervention when needed

## 🔒 Security Features

- **Firebase Authentication** - Industry-standard security
- **Role-based Access** - Admin and user permission levels
- **Data Validation** - Input sanitization and verification
- **Secure Storage** - Encrypted file uploads and data
- **Rate Limiting** - Protection against abuse and spam

## 📱 Mobile Responsiveness

Questa is fully responsive and optimized for:
- **Desktop** (1920x1080 and above)
- **Tablet** (768px - 1024px)
- **Mobile** (320px - 767px)

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow existing code style and patterns
- Add comments for complex functionality
- Test on multiple devices and browsers
- Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Firebase** - For providing excellent backend services
- **Supabase** - For additional backend functionality
- **Font Awesome** - For the beautiful icon library
- **Google Fonts** - For modern typography
- **GitHub** - For free hosting and version control

## 📞 Support

- **Email**: support@questa.com
- **Discord**: [Join our community](https://discord.gg/questa)
- **Issues**: [GitHub Issues](https://github.com/your-username/questa/issues)
- **Documentation**: [Wiki](https://github.com/your-username/questa/wiki)

## 🗺️ Roadmap

### Phase 1 ✅
- [x] Basic quest system
- [x] User authentication
- [x] Admin panel
- [x] Mobile responsiveness

### Phase 2 🚧
- [ ] Payment integration (PayPal, Stripe)
- [ ] Advanced analytics
- [ ] Quest categories and filtering
- [ ] User rating system

### Phase 3 📋
- [ ] Mobile app (React Native)
- [ ] API for third-party integrations
- [ ] Advanced admin tools
- [ ] Gamification features

---

<div align="center">

**🌟 Star this repository if you find it helpful!**

[![GitHub stars](https://img.shields.io/github/stars/your-username/questa?style=social)](https://github.com/your-username/questa/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/your-username/questa?style=social)](https://github.com/your-username/questa/network/members)

**Made with ❤️ for the gaming community**

</div>
