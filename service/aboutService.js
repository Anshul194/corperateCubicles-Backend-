import AboutContent from '../models/AboutContent.js';
import TeamMember from '../models/TeamMember.js';

class AboutService {
  async getAboutContent() {
    let content = await AboutContent.findOne({ isActive: true }).lean();
    if (!content) {
      content = await AboutContent.create({
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
    }
    return content;
  }

  async updateAboutContent(data) {
    let content = await AboutContent.findOne({ isActive: true });
    if (!content) {
      content = new AboutContent(data);
    } else {
      Object.assign(content, data);
    }
    return content.save();
  }

  async getTeamMembers() {
    return TeamMember.find({ isActive: true }).sort({ displayOrder: 1 }).lean();
  }

  async getAllTeamMembers() {
    return TeamMember.find().sort({ displayOrder: 1 }).lean();
  }

  async createTeamMember(data) {
    return TeamMember.create(data);
  }

  async updateTeamMember(id, data) {
    return TeamMember.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteTeamMember(id) {
    return TeamMember.findByIdAndDelete(id);
  }
}

export default new AboutService();
