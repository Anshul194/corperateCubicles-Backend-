import express from 'express';
import { createLapaasTicket } from '../controllers/LapaasTicketController.js';

const lapaasTicketRouter = express.Router();

lapaasTicketRouter.post('/', createLapaasTicket);

export default lapaasTicketRouter;
