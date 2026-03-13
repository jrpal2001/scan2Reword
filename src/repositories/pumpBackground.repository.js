import PumpBackground from '../models/Background.model.js'

export const pumpBackgroundRepository = {

    async create(data) {

        const doc = await PumpBackground.create(data)

        return doc.toObject()

    },

    async findAll() {

        return PumpBackground
            .find()
            .populate('pumpId', 'name')
            .lean()

    },

    async findById(id) {

        return PumpBackground
            .findById(id)
            .populate('pumpId', 'name')
            .lean()

    },

    async findByPumpId(pumpId) {

        return PumpBackground
            .findOne({ pumpId })
            .lean()

    },

    async update(id, data) {

        return PumpBackground
            .findByIdAndUpdate(id, data, { new: true })
            .lean()

    },

    async delete(id) {

        await PumpBackground.findByIdAndDelete(id)

        return true

    }

}