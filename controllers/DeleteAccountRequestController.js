import DeleteAccountRequestService from '../service/DeleteAccountRequestService.js';
const service = new DeleteAccountRequestService();

export const requestDeleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { reason } = req.body;

    const result = await service.createRequest(userId, reason);

    res.status(201).json({
      success: true,
      message: 'Account deletion request submitted successfully.',
      data: result
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// export const getDeleteRequests = async (req, res) => {
//   try {
//     const requests = await service.getAllRequests();
//     res.status(200).json({
//       success: true,
//       message: 'All delete requests fetched',
//       data: requests
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

export const getDeleteRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;

    const result = await service.getAllRequests({
      page,
      limit,
      search,
      status
    });

    res.status(200).json({
      success: true,
      message: 'Delete account requests fetched',
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateDeleteRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const result = await service.updateStatus(id, status);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Delete request not found' });
    }

    res.status(200).json({
      success: true,
      message: `Delete request ${status} successfully`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

