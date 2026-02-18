// utils/pagination.js
export const paginate = (model) => async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;       // current page
    const limit = parseInt(req.query.limit) || 10;    // items per page
    const skip = (page - 1) * limit;

    const totalDocs = await model.countDocuments();
    const totalPages = Math.ceil(totalDocs / limit);

    const data = await model.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); // optional sort

    res.status(200).json({
      success: true,
      totalDocs,
      totalPages,
      currentPage: page,
      pageSize: limit,
      data,
    });
  } catch (error) {
    next(error);
  }
};
