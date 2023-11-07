const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const dbConnection = require('./database');
const { body, validationResult } = require('express-validator');
const mysql = require('mysql2');



const app = express();
app.use(express.urlencoded({extended:false}));

// SET OUR VIEWS AND VIEW ENGINE
app.set('views', path.join(__dirname,'views'));
app.set('view engine','ejs');

// APPLY COOKIE SESSION MIDDLEWARE
app.use(cookieSession({
    name: 'session',
    keys: ['key1', 'key2'],
    maxAge:  3600 * 1000 // 1hr
}));



// DECLARING CUSTOM MIDDLEWARE
const ifNotLoggedin = (req, res, next) => {
    if(!req.session.isLoggedIn){
        return res.render('login-register');
    }
    next();
}
const ifLoggedin = (req,res,next) => {
    if(req.session.isLoggedIn){
        return res.redirect('/home');
    }
    next();
}
// END OF CUSTOM MIDDLEWARE

// ROOT PAGE
app.get('/', ifNotLoggedin, (req,res,next) => {
    dbConnection.execute("SELECT `name` FROM `users` WHERE `id`=?",[req.session.userID])
    .then(([rows]) => {
        res.render('home',{
            name:rows[0].name
        });
    });
    
});// END OF ROOT PAGE


// REGISTER PAGE
app.post('/register', ifLoggedin, 
// post data validation(using express-validator)
[
    body('user_email','Invalid email address!').isEmail().custom((value) => {
        return dbConnection.execute('SELECT `email` FROM `users` WHERE `email`=?', [value])
        .then(([rows]) => {
            if(rows.length > 0){
                return Promise.reject('This E-mail already in use!');
            }
            return true;
        });
    }),
    body('user_name','Username is Empty!').trim().not().isEmpty(),
    body('user_pass','The password must be of minimum length 6 characters').trim().isLength({ min: 6 }),
],// end of post data validation
(req,res,next) => {

    const validation_result = validationResult(req);
    const {user_name, user_pass, user_email} = req.body;
    // IF validation_result HAS NO ERROR
    if(validation_result.isEmpty()){
        // password encryption (using bcryptjs)
        bcrypt.hash(user_pass, 12).then((hash_pass) => {
            // INSERTING USER INTO DATABASE
            dbConnection.execute("INSERT INTO `users`(`name`,`email`,`password`) VALUES(?,?,?)",[user_name,user_email, hash_pass])
            .then(result => {
                res.send(`your account has been created successfully, Now you can <a href="/">Login</a>`);
            }).catch(err => {
                // THROW INSERTING USER ERROR'S
                if (err) throw err;
            });
        })
        .catch(err => {
            // THROW HASING ERROR'S
            if (err) throw err;
        })
    }
    else{
        // COLLECT ALL THE VALIDATION ERRORS
        let allErrors = validation_result.errors.map((error) => {
            return error.msg;
        });
        // REDERING login-register PAGE WITH VALIDATION ERRORS
        res.render('login-register',{
            register_error:allErrors,
            old_data:req.body
        });
    }
});// END OF REGISTER PAGE


// LOGIN PAGE
app.post('/', ifLoggedin, [
    body('user_email').custom((value) => {
        return dbConnection.execute('SELECT email FROM users WHERE email=?', [value])
        .then(([rows]) => {
            if(rows.length == 1){
                return true;
                
            }
            return Promise.reject('Invalid Email Address!');
            
        });
    }),
    body('user_pass','Password is empty!').trim().not().isEmpty(),
], (req, res) => {
    const validation_result = validationResult(req);
    const { user_pass, user_email } = req.body;
    
    if(validation_result.isEmpty()){
        
        dbConnection.execute("SELECT * FROM `users` WHERE `email`=?", [user_email])
        .then(([rows]) => {
            if (rows.length === 1) {
                const user = rows[0];
                bcrypt.compare(user_pass, user.password).then(compare_result => {
                    if(compare_result === true){
                        req.session.isLoggedIn = true;
                        req.session.userID = user.id;

                        // ตรวจสอบเลเวลของผู้ใช้และเปลี่ยนทิศทางไปหน้าต่าง ๆ ตามเลเวล
                        if (user.level === 'Free') {
                            res.redirect('/home');
                        } else if (user.level === 'silver') {
                            res.redirect('/home2');
                        } else if (user.level === 'gold') {
                            res.redirect('/home3');
                        } else if (user.level === 'platinum') {
                            res.redirect('/home4');
                        }
                    }
                    else{
                        res.render('login-register',{
                            login_errors:['Invalid Password!']
                        });
                    }
                })
                .catch(err => {
                    if (err) throw err;
                });
            } else {
                res.render('login-register',{
                    login_errors:['User not found!']
                });
            }
        })
        .catch(err => {
            if (err) throw err;
        });
    }
    else {
        let allErrors = validation_result.errors.map((error) => {
            return error.msg;
        });
        // REDERING login-register PAGE WITH LOGIN VALIDATION ERRORS
        res.render('login-register',{
            login_errors:allErrors
        });
    }
});
// END OF LOGIN PAGE






// LOGOUT
app.get('/logout',(req,res)=>{
    //session destroy
    req.session = null;
    res.redirect('/');
});
// END OF LOGOUT

//home
app.get('/home', (req, res) => {
    // Render the contactus view
    req.session = null;
    res.render('home');
});

//contact
app.get('/contactus', (req, res) => {
    // Render the contactus view
    req.session = null;
    res.render('contactus');
});

//payment s g p
app.get('/paymentp', (req, res) => {
    // patinum
    req.session = null;
    res.render('paymentp');
});
app.get('/paymentg', (req, res) => {
    // gold
    req.session = null;
    res.render('paymentg');
});
app.get('/payments', (req, res) => {
    // silver
    req.session = null;
    res.render('payments');
});

app.get('/home3', (req, res) => {
    // Render the contactus view
    req.session = null;
    res.render('home3');
});

app.get('/home4', (req, res) => {
    // Render the contactus view
    req.session = null;
    res.render('home4');
});

app.get('/home2', (req, res) => {
    // Render the contactus view
    req.session = null;
    res.render('home2');
});
//membership
app.post('/users', async (req, res) => {
    const { email, level } = req.body;

    try {
        const [rows, fields] = await dbConnection.execute("UPDATE users SET level = ? WHERE email = ?", [level, email]);
        if(level== 'silver' ){
        res.redirect('/home2'); // เปลี่ยนไปหน้า /home หลังจากสำเร็จ
    }if(level== 'gold'){
        res.redirect('/home3');
    }if(level=='platinum'){
        res.redirect('/home4')
    }
    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
});



app.post('/history', (req, res) => {
    const { email, productID, startDate, endDate, rentalPrice } = req.body;
    
    const missingFields = [];
    function isValidDate(dateString) {
        // ใช้ regex เพื่อตรวจสอบรูปแบบของวันที่ (YYYY-MM-DD)
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    
        if (!datePattern.test(dateString)) {
            return false;
        }
    
        // ตรวจสอบว่าวันที่เป็นวันที่ถูกต้องจริง
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return false;
        }
    
        return true;
    }

    if (!email) {
        missingFields.push('email');
    }

    if (!productID) {
        missingFields.push('productID');
    }

    if (!startDate) {
        missingFields.push('startDate');
    }

    if (!endDate) {
        missingFields.push('endDate');
    }

    if (!rentalPrice) {
        missingFields.push('rentalPrice');
    }

    if (missingFields.length > 0) {
        return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง: กรุณากรอก ' + missingFields.join(', ') });
    }

    // ตรวจสอบว่า startDate และ endDate เป็นรูปแบบวันที่ที่ถูกต้อง
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง: กรุณาใส่วันที่ให้ถูกต้อง' });
    }

    // ดำเนินการบันทึกข้อมูลการจองลงในตารางการเช่า (RentalHistory) โดยใช้ dbConnection.execute
    const sql = 'INSERT INTO rentalhistory (email, productID, startDate, endDate, rentalPrice) VALUES (?, ?, ?, ?, ?)';
    const values = [email, productID, startDate, endDate, rentalPrice];

    dbConnection.execute(sql, values, (err, result) => {
        if (err) {
            console.error('เกิดข้อผิดพลาดในการบันทึกข้อมูลการจอง:', err);
            res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลการจอง' });
        } else {
            res.status(201).json({ message: 'บันทึกข้อมูลการจองสำเร็จ' });
             if (user.level === 'Free') {
                res.redirect('/home');
            } else if (user.level === 'silver') {
                res.redirect('/home2');
            } else if (user.level === 'gold') {
                res.redirect('/home3');
            } else if (user.level === 'platinum') {
                res.redirect('/home4');
            }
        }
    });
});





//category
app.get('/nikon', (req, res) => {
    req.session = null;
    res.render('nikon');
});
app.get('/canon', (req, res) => {
    req.session = null;
    res.render('canon');
});
app.get('/leica', (req, res) => {
    req.session = null;
    res.render('leica');
});
app.get('/fujifilm', (req, res) => {
    req.session = null;
    res.render('fujifilm');
});
app.get('/olympus', (req, res) => {
    req.session = null;
    res.render('olympus');
});
app.get('/sony', (req, res) => {
    req.session = null;
    res.render('sony');
});


//shop
app.get('/sonyA9', (req, res) => {
    req.session = null;
    res.render('sonyA9');
});

app.get('/CanonEOSR5', (req, res) => {
    req.session = null;
    res.render('CanonEOSR5');
});
app.get('/CanonEOSR6', (req, res) => {
    req.session = null;
    res.render('CanonEOSR6');
});
app.get('/SR6MarkII', (req, res) => {
    req.session = null;
    res.render('SR6MarkII');
});
app.get('/NikonD850', (req, res) => {
    req.session = null;
    res.render('NikonD850');
});
app.get('/NikonZ6Body', (req, res) => {
    req.session = null;
    res.render('NikonZ6Body');
});
app.get('/NikonZ7', (req, res) => {
    req.session = null;
    res.render('NikonZ7');
});
app.get('/SonyZV-E1', (req, res) => {
    req.session = null;
    res.render('SonyZV-E1');
});
app.get('/SonyFE16', (req, res) => {
    req.session = null;
    res.render('SonyFE16');
});
app.get('/LeicaMP240', (req, res) => {
    req.session = null;
    res.render('LeicaMP240');
});
app.get('/LeicaQ2', (req, res) => {
    req.session = null;
    res.render('LeicaQ2');
});
app.get('/Summicron-M', (req, res) => {
    req.session = null;
    res.render('Summicron-M');
});
app.get('/FujifilmX-PRO3', (req, res) => {
    req.session = null;
    res.render('FujifilmX-PRO3');
});
app.get('/FujifilmX-H1', (req, res) => {
    req.session = null;
    res.render('FujifilmX-H1');
});
app.get('/FujifilmX-T5', (req, res) => {
    req.session = null;
    res.render('FujifilmX-T5');
});
app.get('/OlympusOM', (req, res) => {
    req.session = null;
    res.render('OlympusOM');
});
app.get('/ED7-14mm', (req, res) => {
    req.session = null;
    res.render('ED7-14mm');
});
app.get('/ED12-100mm', (req, res) => {
    req.session = null;
    res.render('ED12-100mm');
});
app.get('/return', (req, res) => {
    req.session = null;
    res.render('return');
});


//about us
app.get('/aboutus', (req, res) => {
    // silver
    req.session = null;
    res.render('aboutus');
});


//กำหนด public
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', (req,res) => {
    res.status(404).send('<h1>404 Page Not Found!</h1>');
});

//server
let port = process.env.PORT || 3000;
app.listen(port,() => {
    console.log('Server is running.....')
})