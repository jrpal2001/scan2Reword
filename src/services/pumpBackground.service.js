import { pumpBackgroundRepository } from "../repositories/pumpBackground.repository.js"

export const pumpBackgroundService = {

  async createBackground(pumpId, images, userId) {

    const existing =
      await pumpBackgroundRepository.findByPumpId(pumpId)

    if (existing) {

      return pumpBackgroundRepository.update(
        existing._id,
        { $push: { imageUrl: { $each: images } } }
      )

    }

    return pumpBackgroundRepository.create({
      pumpId,
      imageUrl: images,
      createdBy: userId
    })

  },


  async getAllBackgrounds() {

    return pumpBackgroundRepository.findAll()

  },


  async getBackgroundById(id) {

    return pumpBackgroundRepository.findById(id)

  },


  async updateBackground(id, images) {

    return pumpBackgroundRepository.update(
      id,
      { $push: { imageUrl: { $each: images } } }
    )

  },


  async deleteBackground(id) {

    return pumpBackgroundRepository.delete(id)

  },


  async getPublicBackgrounds(pumpId) {

    if (pumpId) {
      return pumpBackgroundRepository.findByPumpId(pumpId)
    }

    return pumpBackgroundRepository.findAll()

  }

}