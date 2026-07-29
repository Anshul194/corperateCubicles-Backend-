import CoursePlanService from "../service/CoursePlanService.js";
import Course from "../models/Course.js";
const service = new CoursePlanService();

export const createCoursePlan = async (req, res) => {
  try {
    const course = await Course.findById(req.body.courseId);
    if (!course) {
      return res.status(404).json({ success: false, error: "Course not found" });
    }
    // Only allow salePrice, not discount
    const planData = {
      ...req.body,
      salePrice: req.body.salePrice !== undefined ? Number(req.body.salePrice) : 0,
      duration: req.body.duration !== undefined ? Number(req.body.duration) : 0,
      durationType: req.body.durationType || 'lifetime'
      // discount: undefined // ignore any discount field
    };
    const plan = await service.create(planData);
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const getAllCoursePlans = async (req, res) => {
  try {
    const filter = { ...req.query };
    if (!filter.status) {
      filter.status = "active";
    }
    const plans = await service.getAll(filter);
    res.json({ success: true, data: plans });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getCoursePlanById = async (req, res) => {
  try {
    const plan = await service.getById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateCoursePlan = async (req, res) => {
  try {
    const plan = await service.updateById(req.params.id, req.body);
    if (!plan) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const deleteCoursePlan = async (req, res) => {
  try {
    const plan = await service.deleteById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};