require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// ===========================
// MySQL Connection
// ===========================
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// ===========================
// Razorpay
// ===========================
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ===========================
// Test
// ===========================
app.get("/", (req, res) => {
    res.send("Payment Server Running");
});

// ===========================
// Checkout
// ===========================
app.post("/api/checkout", async (req, res) => {

    try {

        const {
            userId,
            fullname,
            email,
            phone,
            address,
            city,
            state,
            pincode,
            amount
        } = req.body;

        const sql = `
        INSERT INTO orders
        (
            user_id,
            fullname,
            email,
            phone,
            address,
            city,
            state,
            pincode,
            amount,
            status
        )
        VALUES
        (
            ?,?,?,?,?,?,?,?,?,?
        )
        `;

        const [result] = await pool.execute(sql, [

            userId,
            fullname,
            email,
            phone,
            address,
            city,
            state,
            pincode,
            amount,
            "Pending"

        ]);

        res.json({

            success: true,
            orderId: result.insertId

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

// ===========================
// Razorpay Order
// ===========================
app.post("/api/create-order", async (req, res) => {

    try {

        const { amount } = req.body;

        const options = {

            amount: amount * 100,
            currency: "INR",
            receipt: "receipt_" + Date.now()

        };

        const order = await razorpay.orders.create(options);

        res.json(order);

    } catch (err) {

        res.status(500).json({

            success: false,
            error: err.message

        });

    }

});

// ===========================
// Payment Success
// ===========================
app.post("/api/payment-success", async (req, res) => {

    try {

        const {

            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId

        } = req.body;

        const body =
            razorpay_order_id +
            "|" +
            razorpay_payment_id;

        const expectedSignature =
            crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {

            return res.status(400).json({

                success: false,
                message: "Invalid Signature"

            });

        }

        await pool.execute(

            `UPDATE orders
             SET status='Paid'
             WHERE id=?`,

            [orderId]

        );

        await pool.execute(

            `INSERT INTO payments
            (
                order_id,
                razorpay_order_id,
                razorpay_payment_id,
                payment_status
            )
            VALUES
            (?,?,?,?)`,

            [

                orderId,
                razorpay_order_id,
                razorpay_payment_id,
                "Success"

            ]

        );

        res.json({

            success: true,
            message: "Payment Successful"

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,
            error: err.message

        });

    }

});

// ===========================
// Payment Details
// ===========================
app.get("/api/payment/:id", async (req, res) => {

    try {

        const [rows] = await pool.execute(

            `SELECT *
             FROM payments
             WHERE id=?`,

            [req.params.id]

        );

        res.json(rows);

    } catch (err) {

        res.status(500).json({

            success: false,
            error: err.message

        });

    }

});

// ===========================
// Start Server
// ===========================
app.listen(PORT, () => {

    console.log("-------------------------------------");
    console.log("Payment Server Started");
    console.log("http://localhost:" + PORT);
    console.log("-------------------------------------");

});
