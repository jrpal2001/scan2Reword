import mongoose from 'mongoose';

const pumpBackgroundSchema = new mongoose.Schema(
    {
        pumpId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Pump',
            required: true,
            unique: true
        },

        imageUrl: [{
            type: String,
            required: true
        }],

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'UserLoyalty',
            required: true
        }
    },
    { timestamps: true }
);

const PumpBackground =
    mongoose.models.PumpBackground ||
    mongoose.model('PumpBackground', pumpBackgroundSchema);

export default PumpBackground;
