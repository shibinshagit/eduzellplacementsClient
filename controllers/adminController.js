const mongoose = require("mongoose");
const Admin = require("../Models/adminSchema");
const User = require("../Models/UserSchema");
const Order = require("../Models/OrderSchema");
const cron = require('node-cron');

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// login=======================================================================================================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the admin by email
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(400).json({ error: "Unauthorized" });
    }

    // Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, admin.password);

    if (isMatch) {
      // Generate a JWT token
      const token = jwt.sign(
        { id: admin._id, email: admin.email },
        "your_jwt_secret_key",
        { expiresIn: "1h" }
      );
      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
      });
    } else {
      res.status(400).json({ error: "Unauthorized" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// postOrder======================================================================================================================

const postOrder = async (req, res) => {
  try {
    // Extract data from request body
    const { name, phone, place, plan, paymentStatus, startDate, endDate } =
      req.body;
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const newUser = new User({
      name,
      phone,
      place,
      paymentStatus,
    });

    if (paymentStatus) {
      if (plan.length === 0) {
        return res.status(204).json({ message: "Fill all plan data" });
      }

      let orderStatus = "soon";

      const currentDate = new Date();
      const orderStartDate = new Date(startDate);
      const orderEndDate = new Date(endDate);

      if (!isNaN(orderStartDate) && !isNaN(orderEndDate)) {
        if (orderStartDate <= currentDate && currentDate <= orderEndDate) {
          orderStatus = "active";
        }
      } else {
        console.error("Invalid date(s) provided");
      }

      console.log(orderStatus);

      const newOrder = new Order({
        userId: newUser._id,
        plan,
        orderStart: startDate,
        orderEnd: endDate,
        leave: [],
        status: orderStatus,
      });

      await newOrder.save();
      newUser.orders.push(newOrder._id);
      await newUser.save();
    }
    await newUser.save();
    res.status(200).json({
      message: "User and order added successfully",
      userId: newUser._id,
    });
  } catch (error) {
    console.error("Error adding user and order:", error);
    res.status(500).json({ message: "Error adding user and order" });
  }
};

// getUsers==============================================================================================================

// const getUsers = async (req, res) => {
//   try {
//     const users = await User.find().populate("orders");
//     res.status(200).json(users);
//   } catch (error) {
//     console.error("Error fetching users:", error);
//     res.status(500).json({ message: "Failed to fetch users" });
//   }
// };

const getUsers = async (req, res) => {
  try {
    const today = new Date();

    // Fetch users with their orders where orderEnd is greater than or equal to today
    const users = await User.aggregate([
      {
        $lookup: {
          from: "orders",
          localField: "orders",
          foreignField: "_id",
          as: "orders",
        },
      },
      {
        $addFields: {
          orders: {
            $filter: {
              input: "$orders",
              as: "order",
              cond: { $gte: ["$$order.orderEnd", today] },
            },
          },
        },
      },
      {
        $addFields: {
          latestOrder: {
            $arrayElemAt: ["$orders", -1],
          },
        },
      },
      {
        $project: {
          name: 1,
          phone: 1,
          place: 1,
          paymentStatus: 1,
          startDate: 1,
          latestOrder: 1,
        },
      },
    ]);

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// getDailyStatistics=====================================================================================================

const getDailyStatistics = async (req, res) => {
  const { date } = req.query;
  try {
    // Parse the date and create start and end times for the day
    const enteredDate = new Date(date); // Make sure 'date' is properly formatted

    // Calculate total orders for the date
    const totalOrders = await Order.countDocuments({
      $and: [{ orderEnd: { $gte: enteredDate } }, { status: "active" }],
    });

    // Calculate breakfast orders for the date
    const breakfastOrders = await Order.countDocuments({
      $and: [{ orderEnd: { $gte: enteredDate } }, { status: "active" }],
      plan: "B",
    });

    // Calculate lunch orders for the date
    const lunchOrders = await Order.countDocuments({
      $and: [{ orderEnd: { $gte: enteredDate } }, { status: "active" }],
      plan: "L",
    });

    // Calculate dinner orders for the date
    const dinnerOrders = await Order.countDocuments({
      $and: [{ orderEnd: { $gte: enteredDate } }, { status: "active" }],
      plan: "D",
    });

    // Construct statistics object
    const statistics = {
      totalOrders,
      breakfastOrders,
      lunchOrders,
      dinnerOrders,
    };

    // Send response with statistics
    res.status(200).json(statistics);
  } catch (error) {
    console.error("Error fetching daily statistics:", error);
    res.status(500).json({ error: "Failed to fetch daily statistics" });
  }
};

// editUser======================================================================================================================
// const editUser = async (req, res) => {
//   try {
//     const userId = req.params.id;
//     const { name, phone, place, plan, paymentStatus, startDate, endDate } = req.body;
//     const updatedUserData = req.body;

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ message: "Invalid user ID" });
//     }

//     const user = User.findById({userId});
//     console.log(user)
//     const userExistingPhone = user.phone;
//     if (!userExistingPhone === phone) {
//       const existingUser = await User.findOne({ phone });
//       if (existingUser) {
//         return res.status(400).json({ message: "Phone number already exists" });
//       }
//     }

//     if (paymentStatus) {
//       if (plan.length === 0) {
//         return res.status(204).json({ message: "Fill all plan data" });
//       }

//       let orderStatus = "soon";

//       const currentDate = new Date();
//       const orderStartDate = new Date(startDate);
//       const orderEndDate = new Date(endDate);

//       if (!isNaN(orderStartDate) && !isNaN(orderEndDate)) {
//         if (orderStartDate <= currentDate && currentDate <= orderEndDate) {
//           orderStatus = "active";
//         }
//       } else {
//         console.error("Invalid date(s) provided");
//       }

//       console.log(orderStatus);

//       const newOrder = new Order({
//         userId: newUser._id,
//         plan,
//         orderStart: startDate,
//         orderEnd: endDate,
//         leave: [],
//         status: orderStatus,
//       });

//       await newOrder.save();
//       newUser.orders.push(newOrder._id);
//       await newUser.save();
//     }
//     const updatedUser = await User.findByIdAndUpdate(
//       userId,
//       { $set: updatedUserData },
//       { new: true, runValidators: true }
//     );

//     if (!updatedUser) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.status(200).json(updatedUser);
//   } catch (error) {
//     console.error("Error updating user:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// edit user ======================================================================

const editUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, place, plan, paymentStatus, startDate, endDate } = req.body;
    console.log('hello',req.body.latestOrder_id)

    // Find the user by ID
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the phone number is changed and if it already exists
    if (user.phone !== phone) {
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({ message: "Phone number already exists" });
      }
      user.phone = phone;
    }

    // Update user details
    user.name = name;
    user.place = place;
    user.paymentStatus = paymentStatus;

    // Handle orders if payment status is updated
    if (paymentStatus) {
      if (!plan || plan.length === 0) {
        return res.status(204).json({ message: "Plan details are required" });
      }

      let orderStatus = "soon";
      const currentDate = new Date();
      const orderStartDate = new Date(startDate);
      const orderEndDate = new Date(endDate);

      if (!isNaN(orderStartDate) && !isNaN(orderEndDate)) {
        if (orderStartDate <= currentDate && currentDate <= orderEndDate) {
          orderStatus = "active";
        }
      } else {
        return res.status(400).json({ message: "Invalid date(s) provided" });
      }

      const latestOrder = await Order.findOne({ userId: user._id }).sort({ orderStart: -1 });
console.log('me',latestOrder)
      if (latestOrder) {
        latestOrder.plan = plan;
        latestOrder.orderStart = startDate;
        latestOrder.orderEnd = endDate;
        latestOrder.status = orderStatus;
        await latestOrder.save();
      } else {
        const newOrder = new Order({
          userId: user._id,
          plan,
          orderStart: startDate,
          orderEnd: endDate,
          leave: [],
          status: orderStatus,
        });

        await newOrder.save();
        user.orders.push(newOrder._id);
      }
    }

    await user.save();
    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Error updating user" });
  }
};
// deleteUser===========================================================================================================================================
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete all orders associated with the user
    await Order.deleteMany({ userId });

    // Delete the user
    await User.findByIdAndDelete(userId);

    return res.status(200).json({ message: 'User and their orders deleted permanently' });
  } catch (error) {
    console.error('Error deleting user and their orders:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};


// trashUser==================================================================================================================================================
const trashUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isDeleted = true;
    await user.save();
    return res.status(200).json({ message: 'User moved to trash' });
  } catch (error) {
    console.error('Error trashing user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// addLeave========================================================================================================================================

const addLeave = async (req, res) => {
  const { orderId } = req.params;
  const { leaveStart, leaveEnd } = req.body;
  
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const leaveStartDate = new Date(leaveStart);
    const leaveEndDate = new Date(leaveEnd);

    // Check if the leave end date is within the order end date
    const orderEndDate = new Date(order.orderEnd);
    if (leaveEndDate > orderEndDate) {
      return res.status(400).json({ message: 'Leave end date exceeds order end date' });
    }

    // Check for overlapping active leave
    const activeLeave = order.leave.find(leave => new Date(leave.end) > new Date());
    if (activeLeave) {
      return res.status(400).json({ message: 'User already has an active leave' });
    }

    // Calculate the number of leave days
    const differenceInTime = leaveEndDate - leaveStartDate;
    const differenceInDays = Math.ceil(differenceInTime / (1000 * 60 * 60 * 24));
    
    // Add 1 to include the start date in the leave period
    const numberOfLeaves = differenceInDays + 1;

    // Add the leave to the order's leave array
    order.leave.push({
      start: leaveStartDate,
      end: leaveEndDate,
      numberOfLeaves,
    });

    // Check if the present day falls within the leave period
    const today = new Date();
    if (today >= leaveStartDate && today <= leaveEndDate) {
      order.status = 'leave';
    }

    await order.save();

    return res.status(200).json({ message: 'Leave added successfully' });
  } catch (error) {
    console.error('Error adding leave:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};



// ====================== Node cron=========================================================================================================================

async function updateOrderStatuses() {
  try {
    const orders = await Order.find({}); // Fetch all orders

    orders.forEach(order => {
      const currentDate = new Date();
      const orderStart = new Date(order.orderStart);
      const orderEnd = new Date(order.orderEnd);

      // Example logic to update statuses
      if (currentDate < orderStart) {
        order.status = 'soon';
      } else if (currentDate >= orderStart && currentDate <= orderEnd) {
        order.status = 'active';
      } else if (currentDate > orderEnd) {
        order.status = 'expired';
      }
console.log('ok',order.status)
      // Save the updated order

      order.save();
    });

    console.log('Order statuses updated successfully');
  } catch (error) {
    console.error('Error updating order statuses:', error);
  }
}

const cleanupJunkOrders = async () => {
  try {
    // Fetch all user IDs
    console.log('opopoo')
    const users = await User.find({}, '_id');
    const userIds = users.map(user => user._id.toString());

    // Find and delete orders with no corresponding user
    const result = await Order.deleteMany({
      userId: { $nin: userIds }
    });

    console.log(`Deleted ${result.deletedCount} junk orders.`);
  } catch (err) {
    console.error('Error cleaning up junk orders:', err);
  } 
};

// Schedule the function to run daily at midnight
// cron.schedule('* * * * * *',cleanupJunkOrders );

// Schedule the function to run daily at midnight
cron.schedule('0 0 * * *', updateOrderStatuses);

module.exports = {
  login,
  postOrder,
  getUsers,
  getDailyStatistics,
  editUser,
  deleteUser,
  trashUser,
  addLeave
};
