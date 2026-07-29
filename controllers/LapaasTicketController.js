import LapaasTicketService from '../service/LapaasTicketService.js';

const lapaasTicketService = new LapaasTicketService();

export const createLapaasTicket = async (req, res) => {
  try {
    const result = await lapaasTicketService.createTicket(req.body);
    res.status(result.isNew ? 201 : 200).json(result);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
