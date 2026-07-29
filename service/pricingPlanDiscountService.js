import PricingPlanDiscountRepository from '../repository/pricingPlanDiscountRepository.js';

export default class PricingPlanDiscountService {
  constructor() {
    this.pricingPlanDiscountRepository = new PricingPlanDiscountRepository();
  }

  async createPricingPlanDiscount(data) {
    try {
      //console.log('PricingPlanDiscountService: Creating discount with data:', data);
      const createdDiscount = await this.pricingPlanDiscountRepository.create(data);
      //console.log('PricingPlanDiscountService: Discount created successfully:', createdDiscount);
      return createdDiscount;
    } catch (error) {
      console.error('PricingPlanDiscountService: Error in createPricingPlanDiscount:', error);
      throw error;
    }
  }

  async getAllPricingPlanDiscounts(query) {
    try {
      return await this.pricingPlanDiscountRepository.findAll(query);
    } catch (error) {
      console.error('Error in getAllPricingPlanDiscounts:', error);
      throw error;
    }
  }

  async getPricingPlanDiscountById(id) {
    try {
      return await this.pricingPlanDiscountRepository.findById(id);
    } catch (error) {
      console.error('Error in getPricingPlanDiscountById:', error);
      throw error;
    }
  }

  async updatePricingPlanDiscount(id, data) {
    try {
      return await this.pricingPlanDiscountRepository.update(id, data);
    } catch (error) {
      console.error('Error in updatePricingPlanDiscount:', error);
      throw error;
    }
  }

  async deletePricingPlanDiscount(id) {
    try {
      return await this.pricingPlanDiscountRepository.delete(id);
    } catch (error) {
      console.error('Error in deletePricingPlanDiscount:', error);
      throw error;
    }
  }
}