import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import TeamMember from '../models/TeamMember.js';
import AboutContent from '../models/AboutContent.js';
import Testimonial from '../models/Testimonial.js';
import FAQ from '../models/FAQ.js';
import Banner from '../models/Banner.js';
import Setting from '../models/setting.js';
import CourseCategory from '../models/CourseCategory.js';
import SiteContent from '../models/SiteContent.js';
import Event from '../models/Event.js';

dotenv.config();

const SUPERADMIN = {
  fullName: 'Super Admin',
  email: 'superadmin@corporatecubicles.com',
  password: 'Admin@123',
  role: 'admin',
  is_verify: true,
  isActive: true,
  skipDeviceApproval: true,
};

const TEAM_MEMBERS = [
  {
    name: 'Arjun Rao',
    role: 'Founder & CEO',
    bio: '15+ years in AI and Data Science. Previously led ML teams at Google and Microsoft.',
    initials: 'AR',
    displayOrder: 1,
  },
  {
    name: 'Shreya Mehta',
    role: 'Head of Curriculum',
    bio: 'PhD in Computer Science. Designed programs adopted by 30+ universities globally.',
    initials: 'SM',
    displayOrder: 2,
  },
  {
    name: 'Vikram Khanna',
    role: 'VP, Corporate Relations',
    bio: 'Built partnerships with 200+ companies including Amazon, Flipkart, and Goldman Sachs.',
    initials: 'VK',
    displayOrder: 3,
  },
  {
    name: 'Dr. Aris Thorne',
    role: 'Lead AI Engineer & Research Mentor',
    bio: 'Ex-Senior AI Researcher with deep expertise in Generative AI, PyTorch, and Deep Learning.',
    initials: 'AT',
    displayOrder: 4,
  },
  {
    name: 'Elena Rostova',
    role: 'Head of Data Science & Analytics',
    bio: 'Enterprise Data Architect specializing in SQL, Python, Predictive Analytics, and Tableau.',
    initials: 'ER',
    displayOrder: 5,
  },
  {
    name: 'Marcus Vance',
    role: 'Staff MLOps & Cloud Architect',
    bio: 'Cloud Infrastructure Lead expert in Docker, Kubernetes, and AWS Data Lakes.',
    initials: 'MV',
    displayOrder: 6,
  },
];

const TESTIMONIALS = [
  {
    name: 'Priya Sharma',
    role: 'Data Scientist at Amazon',
    message: 'Corporate Cubicles completely changed my career trajectory. The project-based approach gave me the confidence to tackle real-world data challenges. I landed my dream job at Amazon within 3 months of completing the program.',
    rating: 5,
    status: 'approved',
  },
  {
    name: 'Rohit Verma',
    role: 'AI Engineer at Flipkart',
    message: 'The mentorship I received was unparalleled. My mentor had 10+ years of industry experience and guided me through every step. Within 6 months, I went from zero coding knowledge to working as an AI engineer.',
    rating: 5,
    status: 'approved',
  },
  {
    name: 'Ananya Patel',
    role: 'Analytics Consultant',
    message: 'The transition from finance to data analytics felt smooth because Corporate Cubicles focuses strictly on industry-ready corporate requirements. The mock interviews were incredibly helpful.',
    rating: 5,
    status: 'approved',
  },
  {
    name: 'Vikram Singh',
    role: 'ML Engineer at Microsoft',
    message: 'The MLOps program was exactly what I needed to upskill. The cloud sandboxes and real-time projects made all the difference in my interview preparation.',
    rating: 5,
    status: 'approved',
  },
  {
    name: 'Neha Gupta',
    role: 'Data Analyst at Deloitte',
    message: 'I was a complete beginner in Python when I joined. The structured curriculum and 1-on-1 mentorship helped me build a strong portfolio. Now I work as a Data Analyst at Deloitte!',
    rating: 5,
    status: 'approved',
  },
];

const FAQS = [
  {
    question: 'What is Corporate Cubicles and how does project-based learning work?',
    answer: 'Corporate Cubicles is a future-focused online training platform designed to empower students and working professionals with industry-ready skills in Data Science, AI, and emerging tech. Instead of dry lectures, you work on real corporate problem statements inside cloud sandboxes and push production code to GitHub.',
    category: 'course',
    sortOrder: 1,
  },
  {
    question: 'Do I need prior coding experience to get started?',
    answer: 'We offer courses tailored for all experience levels! Our beginner tracks start from foundational Python, SQL, and mathematics, while advanced programs cover Generative AI, PyTorch, and production MLOps.',
    category: 'course',
    sortOrder: 2,
  },
  {
    question: 'Will I receive a verified certificate upon course completion?',
    answer: 'Yes! Upon completing all capstone requirements and project evaluations, you will receive a verified Corporate Cubicles Certificate of Completion that you can add to your LinkedIn profile and resume.',
    category: 'course',
    sortOrder: 3,
  },
  {
    question: 'What placement and career support does Corporate Cubicles offer?',
    answer: 'Our Career Launchpad includes 1-on-1 resume reviews, GitHub portfolio optimization, mock technical interviews with lead engineers, and direct referral opportunities through our hiring partner network.',
    category: 'course',
    sortOrder: 4,
  },
  {
    question: 'Can I access the course materials on mobile or after completion?',
    answer: 'Yes, once enrolled, you get lifetime access to recorded modules, updated course materials, community forum discussions, and developer sandboxes.',
    category: 'technical',
    sortOrder: 5,
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit/debit cards, UPI (Google Pay, PhonePe, Paytm), net banking, and EMI options. We also offer flexible installment plans for our premium programs.',
    category: 'purchase',
    sortOrder: 6,
  },
  {
    question: 'Is there a refund policy?',
    answer: 'Yes, we offer a 7-day money-back guarantee on all our programs. If you are not satisfied within the first 7 days of enrollment, we will refund your full course fee, no questions asked.',
    category: 'purchase',
    sortOrder: 7,
  },
];

const COURSE_CATEGORIES = [
  { name: 'Data Science', slug: 'data-science', status: 'active' },
  { name: 'Artificial Intelligence', slug: 'artificial-intelligence', status: 'active' },
  { name: 'MLOps & Cloud', slug: 'mlops-cloud', status: 'active' },
  { name: 'Python & Analytics', slug: 'python-analytics', status: 'active' },
  { name: 'Emerging Tech', slug: 'emerging-tech', status: 'active' },
  { name: 'Data Engineering', slug: 'data-engineering', status: 'active' },
  { name: 'Analytics', slug: 'analytics', status: 'active' },
];

const SITE_CONTENT = {
  hero: {
    badge: 'Future-Focused Online Training Platform',
    title: 'Learn skills that actually change your career',
    highlightedText: 'actually',
    description: 'Corporate Cubicles bridges the gap between academic learning and real-world corporate requirements through practical, project-based education in Data Science, Artificial Intelligence, and emerging technologies.',
    cta: { text: 'Explore All Programs', link: '/courses' },
    secondaryCta: { text: 'About Corporate Cubicles', link: '/about' },
    heroImage: '/about/corporate_cubicles_hero_1784708568337.png',
    rating: '4.9',
    ratingCount: '18k+ Ratings',
    ratingLabel: 'Corporate Project-Based Academy',
    popularCategories: [
      { name: 'Data Science & SQL', link: '/courses' },
      { name: 'Artificial Intelligence & LLMs', link: '/courses' },
      { name: 'Machine Learning', link: '/courses' },
      { name: 'MLOps & Cloud Tech', link: '/courses' },
      { name: 'Python & Analytics', link: '/courses' },
    ],
  },
  howItWorks: {
    badge: 'Project-Based Methodology',
    title: 'How Corporate Cubicles Works',
    description: 'A proven 3-step blueprint that turns learners into confident corporate professionals.',
    steps: [
      {
        num: '01',
        title: 'Learn from Industry Practitioners',
        description: 'Bypass dry textbook lectures. Master concepts through live sessions and recorded modules taught by Lead Data Scientists & AI Engineers.',
        icon: '💻',
      },
      {
        num: '02',
        title: 'Build Corporate-Grade Capstones',
        description: 'Work on actual enterprise datasets inside cloud developer sandboxes. Push production code to GitHub with 1-on-1 code reviews.',
        icon: '⚙️',
      },
      {
        num: '03',
        title: 'Transform into a Job-Ready Professional',
        description: 'Receive verified certifications, portfolio polishing, 1-on-1 mock interviews, and direct recommendations to our corporate hiring network.',
        icon: '🎓',
      },
    ],
    cta: { text: 'Start Learning Now', link: '/courses' },
  },
  brandFeatures: {
    badge: 'Why Corporate Cubicles?',
    title: 'Designed for Modern Corporate Success',
    description: 'We replace outdated academic lectures with active execution on industry-grade projects.',
    features: [
      {
        tag: 'Pillar 01',
        title: 'Practical Data Science',
        description: 'Master Python, SQL, Tableau, and Machine Learning algorithms through hands-on execution with enterprise-grade datasets.',
        icon: '📊',
      },
      {
        tag: 'Pillar 02',
        title: 'Artificial Intelligence & LLMs',
        description: 'Build and deploy neural networks, Large Language Models, Deep Learning pipelines, and autonomous AI agents.',
        icon: '🤖',
      },
      {
        tag: 'Pillar 03',
        title: 'Emerging Tech & MLOps',
        description: 'Scale AI solutions using MLOps pipelines, Docker, Kubernetes, CI/CD, and Cloud Data Infrastructure (AWS/Azure/GCP).',
        icon: '🚀',
      },
      {
        tag: 'Pillar 04',
        title: 'Job Readiness & Portfolio',
        description: 'Graduate with production GitHub repositories, verified portfolio projects, and direct career guidance from top tech mentors.',
        icon: '🎯',
      },
    ],
  },
  enterprise: {
    badge: 'Corporate Cubicles For Business',
    title: 'Upskill Your Workforce in Data Science & Generative AI',
    description: 'Empower your engineering, analytics, and business teams with enterprise-grade learning pathways tailored to your corporate tech stack.',
    features: [
      'Custom Enterprise AI & Data Curricula',
      'Dedicated Technical Mentor Support',
      'Real-Time Analytics & Skill Dashboards',
      'Hands-On Cloud Code Sandboxes',
      'SSO & LMS Integration Capabilities',
      'Verified Industry Certifications',
    ],
    cta: { text: 'Get Corporate Cubicles for Business', link: '/contact' },
    secondaryCta: { text: 'Request a Team Demo', link: '/contact' },
  },
  logoMarquee: {
    label: 'Trusted by Data & AI teams at leading companies worldwide',
    logos: [
      { name: 'Hindustan Times', path: '/logo/hindustan_times.webp' },
      { name: 'India Today', path: '/logo/india_today.webp' },
      { name: 'The Week', path: '/logo/the_week.webp' },
      { name: 'Economic Times', path: '/logo/economic_times.webp' },
      { name: 'The Print', path: '/logo/the_print.webp' },
      { name: 'YourStory', path: '/logo/yourstory.webp' },
      { name: 'ANI', path: '/logo/ani.webp' },
      { name: 'Daily Hunt', path: '/logo/daily_hunt.webp' },
    ],
  },
  easyMoney: {
    badge: 'The Career Accelerator Framework',
    title: 'Bridge the Gap to High-Paying AI & Data Science Roles',
    description: 'Corporate Cubicles provides the exact project-based blueprint designed to elevate your technical confidence and land top roles.',
    challenges: [
      'Lack of practical, real-world data science experience',
      'Outdated university curriculum disconnected from corporate needs',
      'Inability to write production-grade Python & ML code',
      'No verified portfolio of live AI applications',
      'Difficulty passing technical coding interviews',
      'Uncertain career path in the AI-driven job market',
    ],
    outcomes: [
      'A verified GitHub portfolio of live Data Science & AI capstones',
      'Mastery of Generative AI, PyTorch, SQL, MLOps, and Cloud Tech',
      '1-on-1 mentorship from senior Lead AI Engineers',
      'Direct placement assistance & corporate hiring network access',
    ],
    cta: { text: 'Start Your AI & Data Journey Now', link: '/courses' },
  },
  growth: {
    badge: 'Corporate Career Accelerator',
    title: 'Ready to Step Into an AI & Data Science Career?',
    description: 'Join thousands of ambitious students and professionals mastering industry-ready skills with Corporate Cubicles.',
    cta: { text: 'Explore Programs', link: '/courses' },
    secondaryCta: { text: 'Book Career Call', link: '/contact' },
  },
  instructors: {
    badge: 'Industry Veterans',
    title: 'Learn from Top AI & Data Practitioners',
    cta: { text: 'Meet All Mentors', link: '/about' },
    instructors: [
      {
        name: 'Dr. Aris Thorne',
        role: 'Lead AI Engineer & Research Mentor',
        org: 'Ex-Senior AI Researcher',
        rating: '4.9',
        students: '28,000+ Students',
        courses: '6 Courses',
        image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        skills: 'Generative AI, PyTorch, Deep Learning',
      },
      {
        name: 'Elena Rostova',
        role: 'Head of Data Science & Analytics',
        org: 'Enterprise Data Architect',
        rating: '4.9',
        students: '34,000+ Students',
        courses: '8 Courses',
        image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
        skills: 'SQL, Python, Predictive Analytics, Tableau',
      },
      {
        name: 'Marcus Vance',
        role: 'Staff MLOps & Cloud Architect',
        org: 'Cloud Infrastructure Lead',
        rating: '4.8',
        students: '19,500+ Students',
        courses: '4 Courses',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        skills: 'Docker, Kubernetes, AWS Data Lakes',
      },
    ],
  },
  footer: {
    brand: {
      name: 'Corporate Cubicles',
      logo: '/logo.svg',
      description: 'Future-focused online training company empowering students and professionals with industry-ready skills in Data Science, Artificial Intelligence, and emerging technologies.',
      tagline: 'Bridging academic learning with real-world corporate requirements through project-based education.',
    },
    categories: {
      title: 'Top Categories',
      links: [
        { label: 'Data Science & SQL', path: '/courses' },
        { label: 'Artificial Intelligence & LLMs', path: '/courses' },
        { label: 'Machine Learning', path: '/courses' },
        { label: 'Emerging Tech & MLOps', path: '/courses' },
      ],
    },
    company: {
      title: 'Company',
      links: [
        { label: 'About Corporate Cubicles', path: '/about' },
        { label: 'All Programs', path: '/courses' },
        { label: 'Contact & Support', path: '/contact' },
        { label: 'Community Forum', path: '/forum' },
      ],
    },
    copyright: 'Corporate Cubicles Training Pvt. Ltd. All rights reserved.',
    bottomLinks: [
      { label: 'About Us', path: '/about' },
      { label: 'Contact', path: '/contact' },
      { label: 'Courses', path: '/courses' },
    ],
  },
};

async function seed() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error('MONGO_URI not set in .env');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // 1. Create superadmin
    const existingAdmin = await User.findOne({ email: SUPERADMIN.email });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(SUPERADMIN.password, 10);
      await User.create({ ...SUPERADMIN, password: hashedPassword });
      console.log('Superadmin created:');
      console.log(`  Email: ${SUPERADMIN.email}`);
      console.log(`  Password: ${SUPERADMIN.password}`);
    } else {
      console.log('Superadmin already exists, skipping...');
    }

    // 2. Seed course categories
    for (const cat of COURSE_CATEGORIES) {
      const existing = await CourseCategory.findOne({ slug: cat.slug });
      if (!existing) {
        await CourseCategory.create(cat);
        console.log(`Course category created: ${cat.name}`);
      } else {
        console.log(`Course category already exists: ${cat.name}`);
      }
    }

    // 3. Seed team members
    for (const tm of TEAM_MEMBERS) {
      const existing = await TeamMember.findOne({ name: tm.name });
      if (!existing) {
        await TeamMember.create(tm);
        console.log(`Team member created: ${tm.name}`);
      } else {
        console.log(`Team member already exists: ${tm.name}`);
      }
    }

    // 4. Seed testimonials
    for (const t of TESTIMONIALS) {
      const existing = await Testimonial.findOne({ name: t.name, message: t.message });
      if (!existing) {
        await Testimonial.create(t);
        console.log(`Testimonial created: ${t.name}`);
      } else {
        console.log(`Testimonial already exists: ${t.name}`);
      }
    }

    // 5. Seed FAQs
    for (const faq of FAQS) {
      const existing = await FAQ.findOne({ question: faq.question });
      if (!existing) {
        await FAQ.create(faq);
        console.log(`FAQ created: ${faq.question.substring(0, 50)}...`);
      } else {
        console.log(`FAQ already exists: ${faq.question.substring(0, 50)}...`);
      }
    }

    // 6. Seed site content sections
    for (const [section, data] of Object.entries(SITE_CONTENT)) {
      const existing = await SiteContent.findOne({ section });
      if (!existing) {
        await SiteContent.create({ section, data, isActive: true });
        console.log(`Site content created: ${section}`);
      } else {
        console.log(`Site content already exists: ${section}, updating...`);
        await SiteContent.findOneAndUpdate({ section }, { data, isActive: true });
        console.log(`Site content updated: ${section}`);
      }
    }

    // 7. Ensure about content exists
    const existingContent = await AboutContent.findOne({ isActive: true });
    if (!existingContent) {
      await AboutContent.create({
        heroBadge: 'About Corporate Cubicles',
        heroTitle: "Empowering Tomorrow's AI & Data Science Leaders",
        heroDescription: 'We bridge the gap between academic learning and real-world corporate demands through practical, project-based education.',
        stats: [
          { label: 'Learners Trained', value: '15K+', change: '+120% YoY' },
          { label: 'Placement Rate', value: '97%', change: 'Verified Outcomes' },
          { label: 'Corporate Partners', value: '200+', change: 'Global Network' },
          { label: 'Avg. Rating', value: '4.8', change: 'Learner Reviews' },
        ],
        storyTitle: 'Our Story',
        storyParagraphs: [
          'Corporate Cubicles was founded with a simple belief: education should lead directly to employability. We saw a massive gap between what universities teach and what the industry needs — and we set out to bridge it.',
          'Today, we partner with 200+ leading companies to design curricula that reflect real-world challenges. Every course is built around hands-on projects, mentorship from industry veterans, and a curriculum that evolves as fast as technology itself.',
          'From a small classroom to a community of 15,000+ learners, our mission remains unchanged: transform passionate individuals into job-ready professionals who thrive in AI and data-driven workplaces.',
        ],
        missionTitle: 'Our Mission',
        missionDescription: 'To democratize high-quality tech education by providing industry-aligned, project-based learning experiences that equip students and professionals with the practical skills needed to excel in Data Science, AI, and emerging technologies.',
        visionTitle: 'Our Vision',
        visionDescription: 'A world where every learner — regardless of background — has the opportunity to build a thriving career in technology. We envision a future where Corporate Cubicles is the launchpad for the next generation of data-driven innovators and AI leaders.',
        values: [
          { title: 'Industry Alignment', description: 'Curriculum co-created with corporate partners to ensure you learn exactly what employers demand.' },
          { title: 'Learning by Doing', description: 'Every concept reinforced with real-world projects, case studies, and hands-on assignments.' },
          { title: 'Mentorship', description: 'Learn from industry veterans who bring years of hands-on experience from top tech companies.' },
          { title: 'Career First', description: 'From resume workshops to mock interviews, every program is built to land you your dream role.' },
        ],
        comparisons: [
          { feature: 'Learning Focus', academic: 'Theoretical concepts & written exams', corporate: 'Real-world corporate projects & production code' },
          { feature: 'Curriculum Updates', academic: 'Outdated textbooks refreshed every 3-5 years', corporate: 'Updated quarterly with emerging AI & Data Tech' },
          { feature: 'Instructor Expertise', academic: 'Academic researchers & professors', corporate: 'Active Lead AI Engineers & Senior Data Scientists' },
          { feature: 'Outcome & Portfolio', academic: 'Paper degree with no live project proof', corporate: 'Production GitHub portfolio + Job placement support' },
        ],
        ctaTitle: 'Ready to Future-Proof Your Career?',
        ctaDescription: 'Join 15,000+ learners who have transformed their careers with Corporate Cubicles.',
        ctaButtonText: 'Explore Courses',
        ctaButtonLink: '/courses',
      });
      console.log('About content created');
    } else {
      console.log('About content already exists, skipping...');
    }

    // 8. Seed settings
    const defaultSettings = [
      { key: 'gstRate', value: 0.18, description: 'Default GST rate for order calculations' },
      { key: 'RAZORPAY_KEY_ID', value: 'rzp_test_placeholder', description: 'Razorpay Key ID' },
    ];
    for (const s of defaultSettings) {
      const existing = await Setting.findOne({ key: s.key });
      if (!existing) {
        await Setting.create(s);
        console.log(`Setting created: ${s.key}`);
      } else {
        console.log(`Setting already exists: ${s.key}`);
      }
    }

    console.log('\nSeed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
