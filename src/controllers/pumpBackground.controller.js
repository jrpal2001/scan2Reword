import { pumpBackgroundService } from "../services/pumpBackground.service.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js"
import { HTTP_STATUS } from "../constants/errorCodes.js"

export const createBackground = asyncHandler(async (req, res) => {

    const pumpId = req.body.pumpId
    if (!pumpId) throw new ApiError(HTTP_STATUS.BAD_REQUEST, "pumpId is required")

    const uploadedImages = req.s3Uploads?.imageUrl || []

    const background = await pumpBackgroundService.createBackground(
        pumpId,
        uploadedImages,
        req.user._id
    )

    res.status(HTTP_STATUS.CREATED).json(
        ApiResponse.success(background, "Pump background created")
    )

})


export const getAllBackgrounds = asyncHandler(async (req, res) => {

    const data = await pumpBackgroundService.getAllBackgrounds()

    res.status(HTTP_STATUS.OK).json(ApiResponse.success(data))

})


export const getBackgroundById = asyncHandler(async (req, res) => {

    const data = await pumpBackgroundService.getBackgroundById(req.params.id)

    res.status(HTTP_STATUS.OK).json(ApiResponse.success(data))

})


export const updateBackground = asyncHandler(async (req, res) => {

    const uploadedImages = req.s3Uploads?.imageUrl || []

    let existingImages = req.body?.existingImages || []
    if (typeof existingImages === 'string') {
        existingImages = [existingImages]
    }
    existingImages = existingImages.filter(img => img && img.trim() !== '')

    const finalImages = [...existingImages, ...uploadedImages]

    if (!finalImages.length)
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, "At least one image must be present")

    const data = await pumpBackgroundService.updateBackground(
        req.params.id,
        finalImages
    )

    res.status(HTTP_STATUS.OK).json(
        ApiResponse.success(data, "Background updated")
    )

})


export const deleteBackground = asyncHandler(async (req, res) => {

    await pumpBackgroundService.deleteBackground(req.params.id)

    res.status(HTTP_STATUS.OK).json(
        ApiResponse.success(null, "Background deleted")
    )

})


export const getPublicBackgrounds = asyncHandler(async (req, res) => {

    const pumpId = req.query.pumpId || req.user?.pumpId

    const data = await pumpBackgroundService.getPublicBackgrounds(pumpId)

    res.status(HTTP_STATUS.OK).json(ApiResponse.success(data))

})