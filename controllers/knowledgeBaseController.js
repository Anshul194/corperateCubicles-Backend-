import KnowledgeBase from '../models/KnowledgeBase.js';
import { extractTextFromPdf, extractTextFromUrl, extractTextFromDocx, extractTextFromXlsx, extractTextFromTxt } from '../utils/parser.js';
import vectorService from '../service/vectorService.js';
import path from 'path';
import fs from 'fs';

const processItemInternal = async (item, contentOrBuffer) => {
    console.log(`[Knowledge Base] Starting to process item ${item._id}: ${item.title}`);
    try {
        item.status = 'processing';
        await item.save();
        console.log(`[Knowledge Base] Item ${item._id} status changed to processing`);

        let content = '';
        if (item.type === 'url') {
            console.log(`[Knowledge Base] Extracting from URL: ${item.source}`);
            content = await extractTextFromUrl(item.source);
        } else if (item.type === 'pdf') {
            console.log(`[Knowledge Base] Extracting from PDF`);
            content = await extractTextFromPdf(contentOrBuffer);
        } else if (item.type === 'docx') {
            console.log(`[Knowledge Base] Extracting from DOCX`);
            content = await extractTextFromDocx(contentOrBuffer);
        } else if (item.type === 'xlsx') {
            console.log(`[Knowledge Base] Extracting from XLSX`);
            content = await extractTextFromXlsx(contentOrBuffer);
        } else if (item.type === 'text') {
            console.log(`[Knowledge Base] Extracting from text file`);
            content = typeof contentOrBuffer === 'string' ? contentOrBuffer : contentOrBuffer.toString('utf-8');
        }

        if (!content) throw new Error('Could not extract content');
        console.log(`[Knowledge Base] Extracted ${content.length} characters from ${item.title}`);

        item.content = content;
        await item.save(); // Save content
        console.log(`[Knowledge Base] Content saved for ${item._id}`);

        // Try to index in vector database, but don't fail if it's unavailable
        try {
            console.log(`[Knowledge Base] Attempting vector indexing for ${item._id}`);
            await vectorService.upsertKnowledge(item._id, item.title, content, item.type);
            console.log(`[Knowledge Base] Vector indexing successful for ${item._id}`);
        } catch (vectorError) {
            console.warn(`[Knowledge Base] Vector indexing failed for item ${item._id}, but continuing:`, vectorError.message);
        }

        item.status = 'completed';
        await item.save();
        console.log(`[Knowledge Base] Item ${item._id} completed successfully`);
    } catch (error) {
        console.error(`[Knowledge Base] Error processing item ${item._id}:`, error);
        item.status = 'failed';
        item.error = error.message;
        await item.save();
        console.log(`[Knowledge Base] Item ${item._id} marked as failed`);
    }
}

export const addKnowledgeBaseItem = async (req, res) => {
    try {
        const { type } = req.body;
        if (type === 'url') {
            const { title, url } = req.body;
            if (!url || !title) return res.status(400).json({ success: false, message: 'URL and Title are required' });

            const newItem = await KnowledgeBase.create({
                type: 'url',
                title,
                source: url,
                content: '',
                status: 'pending'
            });

            processItemInternal(newItem, null).catch(err => console.error("Async error:", err));

            return res.status(201).json({ success: true, items: [newItem] });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }

        const newItems = [];

        for (const file of req.files) {
            let fileType = 'text';
            const mime = file.mimetype;
            const ext = path.extname(file.originalname).toLowerCase();

            if (mime === 'application/pdf' || ext === '.pdf') fileType = 'pdf';
            else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') fileType = 'docx';
            else if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx') fileType = 'xlsx';
            else if (mime.startsWith('text/') || ['.txt', '.md', '.markdown', '.csv', '.log'].includes(ext)) fileType = 'text';

            console.log(`[Knowledge Base] Creating item for file: ${file.originalname}, type: ${fileType}`);

            const newItem = await KnowledgeBase.create({
                type: fileType,
                title: file.originalname,
                source: file.originalname,
                content: '',
                status: 'pending'
            });

            newItems.push(newItem);
            console.log(`[Knowledge Base] Item created with ID: ${newItem._id}, starting async processing`);

            // Start processing immediately in background
            setImmediate(() => {
                processItemInternal(newItem, file.buffer).catch(err => {
                    console.error(`[Knowledge Base] Async processing error for ${newItem._id}:`, err);
                });
            });
        }

        return res.status(201).json({ success: true, items: newItems });
    } catch (error) {
        console.error('Error adding knowledge base item:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
};

export const listKnowledgeBaseItems = async (req, res) => {
    try {
        const items = await KnowledgeBase.find().select('-content').sort({ createdAt: -1 });
        return res.status(200).json({ success: true, items });
    } catch (error) {
        console.error('Error listing knowledge base items:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const deleteKnowledgeBaseItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await KnowledgeBase.findByIdAndDelete(id);
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

        try {
            await vectorService.deleteKnowledge(id);
        } catch (vectorError) {
            console.error('Error deleting knowledge from Qdrant:', vectorError);
        }

        return res.status(200).json({ success: true, message: 'Item deleted' });
    } catch (error) {
        console.error('Error deleting knowledge base item:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

export const getKnowledgeBaseItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await KnowledgeBase.findById(id);
        if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
        return res.status(200).json({ success: true, item });
    } catch (error) {
        console.error('Error fetching knowledge base item:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
