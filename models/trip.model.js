import mongoose from "mongoose";

const tripSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    current_location: { 
        type: String, 
        required: true, 
        trim: true 
    },
    pickup_location: { 
        type: String, 
        required: true, 
        trim: true 
    },
    dropoff_location: { 
        type: String, 
        required: true, 
        trim: true 
    },
    cycle_used_hours: { 
        type: Number, 
        required: true, 
        min: 0, 
        max: 70 
    },
    trip_start_date: { 
        type: String, 
        required: true, 
        match: /^\d{4}-\d{2}-\d{2}$/ 
    },
    status: { 
        type: String, 
        enum: ['DRAFT', 'PLANNED'], 
        default: 'DRAFT' 
    },
    distance_miles: Number,
    route_duration_hours: Number,
    route_geojson: mongoose.Schema.Types.Mixed,
    route_points: mongoose.Schema.Types.Mixed,
}, { timestamps: true });


const Trip = mongoose.model('Trip', tripSchema);
export default Trip;