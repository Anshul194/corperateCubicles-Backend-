import axios from 'axios';
import QueryRepository from '../repository/QueryRepository.js';

const LAPAAS_TICKET_URL = process.env.LAPAAS_TICKET_URL || 'https://npdmlsgiupranumqkgum.supabase.co/functions/v1/ticket-ingest/ticket';

export default class LapaasTicketService {
  constructor() {
    this.queryRepository = new QueryRepository();
  }

  async createTicket(data) {
    const { name, email, phone, subject, message, source, extra } = data;

    if (!name || !email || !subject) {
      const error = new Error('Missing required fields: name, email, subject');
      error.status = 400;
      throw error;
    }

    const payload = {
      name,
      email,
      phone: phone || '',
      subject,
      message: message || 'No message provided.',
      source: source || 'Contact Form',
      extra: {
        website: extra?.website || '',
        pageUrl: extra?.pageUrl || '',
        referrer: extra?.referrer || '',
        formName: extra?.formName || 'Contact Form',
        utm: {
          source: extra?.utm?.source || '',
          medium: extra?.utm?.medium || '',
          campaign: extra?.utm?.campaign || ''
        },
        ...(extra?.services && { services: extra.services }),
        ...(extra?.budget && { budget: extra.budget }),
        ...(extra?.selectedPlan && { selectedPlan: extra.selectedPlan })
      }
    };

    const response = await axios.post(LAPAAS_TICKET_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    try {
      await this.queryRepository.create({
        name,
        email,
        phone: phone || '',
        message: message || 'No message provided.',
        category: this.mapSubjectToCategory(subject),
        status: 'new'
      });
    } catch (localErr) {
      console.error('Failed to save local query record:', localErr.message);
    }

    return response.data;
  }

  mapSubjectToCategory(subject) {
    const mapping = {
      'Billing or Payment Issue': 'billing',
      'Course': 'course',
      'Course Enquiry': 'course',
      'Technical Support': 'technical',
      'Complaint': 'other',
      'Feedback': 'general',
    };
    return mapping[subject] || 'general';
  }
}
