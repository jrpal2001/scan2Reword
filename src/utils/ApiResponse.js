class ApiResponse {
	constructor({ success, message = 'Success', data = null, meta = null } = {}) {
		this.success = Boolean(success);
		this.message = message;
		this.data = data;
		this.meta = meta;
	}

	static success(data = null, message = 'Success', meta = null) {
		return new ApiResponse({ success: true, message, data, meta });
	}

	/**
	 * Build success response for paginated list APIs.
	 * @param {{ list: any[], total: number, page: number, limit: number, totalPages: number }} result - From repository list()
	 * @param {string} message
	 * @returns {ApiResponse} data = result.list, meta = { total, page, limit, totalPages }
	 */
	static paginated(result, message = 'Success') {
		const meta =
			result != null && typeof result === 'object' && 'total' in result
				? {
						total: result.total,
						page: result.page,
						limit: result.limit,
						totalPages: result.totalPages,
					}
				: null;
		const data = result?.list ?? [];
		return new ApiResponse({ success: true, message, data, meta });
	}

	static error(message = 'Error', data = null, meta = null) {
		return new ApiResponse({ success: false, message, data, meta });
	}
}

export { ApiResponse };
export default ApiResponse;