import SalesAnalyticsService from '../service/SalesAnalyticsService.js';

// Helper to convert $numberDecimal to number
function normalizeDecimalFields(arr, fields = ['totalSales', 'totalSpent']) {
  return arr.map(item => {
    const newItem = { ...item };
    fields.forEach(field => {
      if (newItem[field] && typeof newItem[field] === 'object' && newItem[field].$numberDecimal) {
        newItem[field] = parseFloat(newItem[field].$numberDecimal);
      }
    });
    return newItem;
  });
}

// Get total sales per course
export const getCourseSales = async (req, res) => {
  try {
    const data = await SalesAnalyticsService.getCourseSales();
    res.json({ success: true, data: normalizeDecimalFields(data, ['totalSales']) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get total sales per user
export const getUserSales = async (req, res) => {
  try {
    const data = await SalesAnalyticsService.getUserSales();
    res.json({ success: true, data: normalizeDecimalFields(data, ['totalSpent']) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get sales summary (total revenue, orders, etc)
export const getSalesSummary = async (req, res) => {
  try {
    const data = await SalesAnalyticsService.getSalesSummary();
    // If totalRevenue is Decimal128, convert to number
    if (data.totalRevenue && typeof data.totalRevenue === 'object' && data.totalRevenue.$numberDecimal) {
      data.totalRevenue = parseFloat(data.totalRevenue.$numberDecimal);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get sales per bundle
export const getBundleSales = async (req, res) => {
  try {
    const data = await SalesAnalyticsService.getBundleSales();
    res.json({ success: true, data: normalizeDecimalFields(data, ['totalSales']) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
