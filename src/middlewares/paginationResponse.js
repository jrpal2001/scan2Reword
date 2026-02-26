import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Build meta object from pagination result (total, page, limit, totalPages).
 * Used by sendPaginated (list APIs) and sendPaginatedMeta (custom payload + pagination, e.g. getWallet).
 */
function paginationMeta(pagination) {
	if (pagination == null || typeof pagination !== 'object' || !('total' in pagination)) return null;
	return {
		total: pagination.total,
		page: pagination.page,
		limit: pagination.limit,
		totalPages: pagination.totalPages,
	};
}

/**
 * Middleware that adds res.sendPaginated and res.sendPaginatedMeta for paginated APIs.
 *
 * - sendPaginated(result, message, statusCode): for list APIs where result = { list, total, page, limit, totalPages }.
 * - sendPaginatedMeta(data, paginationResult, message, statusCode): for custom payloads (e.g. getWallet) that include
 *   a paginated section; paginationResult is { total, page, limit, totalPages } (e.g. result.ledger).
 */
export function paginationResponse(_, res, next) {
	res.sendPaginated = function (result, message = 'Success', statusCode = 200) {
		return res.status(statusCode).json(ApiResponse.paginated(result, message));
	};
	res.sendPaginatedMeta = function (data, paginationResult, message = 'Success', statusCode = 200) {
		const meta = paginationMeta(paginationResult);
		return res.status(statusCode).json(ApiResponse.success(data, message, meta));
	};
	next();
}
