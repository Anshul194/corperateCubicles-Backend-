import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import TeamMember from '../models/TeamMember.js';
import AboutContent from '../models/AboutContent.js';
import Testimonial from '../models/Testimonial.js';

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
];

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

    // 2. Seed team members
    for (const tm of TEAM_MEMBERS) {
      const existing = await TeamMember.findOne({ name: tm.name });
      if (!existing) {
        await TeamMember.create(tm);
        console.log(`Team member created: ${tm.name}`);
      } else {
        console.log(`Team member already exists: ${tm.name}`);
      }
    }

    // 3. Seed testimonials
    for (const t of TESTIMONIALS) {
      const existing = await Testimonial.findOne({ name: t.name, message: t.message });
      if (!existing) {
        await Testimonial.create(t);
        console.log(`Testimonial created: ${t.name}`);
      } else {
        console.log(`Testimonial already exists: ${t.name}`);
      }
    }

    // 4. Ensure about content exists
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

    console.log('\nSeed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
