
const functions = require('../helpers/functions');
const orders = require('../classes/orders.class');
const mailerMod = require('./mailer.model');
//var conn = require('../database/mysql.lib').DB2;
const anything = require('../../config/anything.js');
var sha512 = require('js-sha512');
const fetch = require('node-fetch');

// initialize core api client object
let core = new partnerClient.CoreApi({
    isProduction: anything.midProduction,
    serverKey: anything.serverKey,
    clientKey: anything.clientKey
});


module.exports = {
    callbackGopayNew: async function (req, res) {

        var $q;

        var data = req.body;
        var transaction_time = data.transaction_time;
        var transaction_status = data.transaction_status;
        var transaction_id = data.transaction_id;
        var status_message = data.status_message;
        var status_code = data.status_code;
        var signature_key = data.signature_key;
        var payment_type = data.payment_type;
        var order_id = data.order_id; // invoice id
        var merchant_id = data.merchant_id;
        var gross_amount = data.gross_amount;
        var fraud_status = data.fraud_status;
        var currency = data.currency;

        const date_now = functions.dateNow();

        console.log('callback gopay');
        console.log(data);

        var dataInsert = [
            status_message,
            transaction_id,
            order_id,
            gross_amount,
            payment_type,
            transaction_time,
            transaction_status,
            signature_key,
            JSON.stringify(data)
        ];

        // Insert data callback

        $q = `INSERT INTO partner_callback
            (status_message, transaction_id, invoice_id, gross_amount, payment_type, transaction_time, transaction_status, signature_key, text_callback)
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;


        console.log('Query Insert : ' + $q);
        var connection = await connSentral.getConnection();
        empResult = await connection.executeQuery($q, dataInsert);
        connection.close();
        console.log(empResult);

        if (typeof empResult == 'undefined') {
            var returnData = JSON.stringify({ status: false, message: 'Insert Callback Error' });
            res.setHeader('Content-Type', 'application/json');
            res.send(returnData);
            return false;
        }

        // end

        var $q = `SELECT * FROM payment_partner WHERE invoice_id = '` + order_id + `'`;
        connection = await connSentral.getConnection();
        var dataPayment = await connection.executeQuery($q);
        connection.close();
        if (typeof empResult == 'undefined') {
            var returnData = JSON.stringify({ status: false, message: 'Insert Callback Error' });
            res.setHeader('Content-Type', 'application/json');
            res.send(returnData);
            return false;
        }

        var status_code_ = '200';
        var gross_amount_ = gross_amount;
        var serverKey = anything.serverKey;

        var gabung = order_id + status_code_ + gross_amount_ + serverKey;
        console.log(gabung + " bergabung");

        var hasilGabung = sha512(gabung);

        console.log(hasilGabung + " hasil gabung");
        console.log(signature_key + " signature_key");

        if (signature_key !== hasilGabung) {
            var returnData = JSON.stringify({ status: false, message: 'Error Signature key' });
            res.setHeader('Content-Type', 'application/json');
            res.send(returnData);
            return false;
        }

        // Update Status Payment
        $q = `UPDATE payment_partner SET transaction_status = '` + transaction_status + `' WHERE transaction_id = '` + transaction_id + `'`;
        console.log('Query Update : ' + $q);
        connection = await connSentral.getConnection();
        empResult = await connection.executeQuery($q);
        connection.close();
        if (typeof empResult == 'undefined') {
            var returnData = JSON.stringify({ status: false, message: 'Update Status Error' });
            res.setHeader('Content-Type', 'application/json');
            res.send(returnData);
            return false;
        }

        var dataPayment_ = dataPayment[0];
        console.log('TESTING ========');
        console.log(dataPayment_);

        if (transaction_status === 'settlement') {

            if (dataPayment_.instant_delivery == 0) {
                // CEK no invoice sudah ada atau belum
                var Q = `SELECT COUNT(*) as jumlah FROM orders WHERE orders_nomor = '` + functions.sanitizeString(order_id) + `';`;
                connection = await connSentral.getConnection();
                var dataOrdersExist = await connection.executeQuery(Q);
                connection.close();
                if (typeof dataOrdersExist !== 'undefined') {
                    var jumlahOrdersExist = dataOrdersExist[0].jumlah;

                    if (parseInt(jumlahOrdersExist) > 0) {
                        var returnData = JSON.stringify({ status: false, message: 'Invoice Number Sudah Ada' });
                        res.setHeader('Content-Type', 'application/json');
                        res.send(returnData);
                        return false;
                    }
                }

                // get data orders cart
                $q = `SELECT * FROM orders_cart WHERE orders_nomor = '` + order_id + `' LIMIT 1;`;
                console.log('Query : ' + $q);
                connection = await connSentral.getConnection();
                empResult = await connection.executeQuery($q);
                connection.close();
                if (typeof empResult == 'undefined') {
                    var returnData = JSON.stringify({ status: false, message: 'Get Data order cart Error' });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(returnData);
                    return false;
                }

                var ordersCartID = 0; // table orders_cart
                if (empResult.length > 0) {
                    var dataOrderCart = empResult[0];
                    ordersCartID = dataOrderCart['orders_id'];
                }

                // ini kenapa order status udh langsung di ubah jadi 2 ya, karna untuk masuk ke proses ini statusnya sudah bayar
                $q = `INSERT INTO orders (orders_nomor, members_id, orders_status, vouchers_id, vouchers_name, voucers_detil_id, orders_amount, orders_amount_real, orders_amount_addons, orders_amount_ongkir, orders_amount_ongkir_frozen, orders_pax, orders_pax_addons150, orders_pax_addons100, orders_kode_unik, voucers_amount, orders_potongan_saldo, orders_notes, orders_payment_method, utm_source, bank_id, ms_penerima, ms_notelp, ms_detail, kelurahan_id, kelurahan_text, orders_from_admin, image_pembayaran_url, image_pembayaran_mime, orders_date_created, orders_is_deleted, bank_code, orders_id_migrasi, orders_ongkir_noncatering, orders_pax_frozeen, orders_amount_ongkir_paxel, orders_amount_ongkir_mrspeedy, orders_amount_ongkir_jne, admin_id, ms_id, ms_nama, members_id_merge,tax_value,total_pajak, orders_date_insert, voucher_amount_ongkir,orders_pax_mm,orders_pax_addons_mm,orders_amount_addons_mm)
                               SELECT orders_nomor, members_id, 2 as orders_status, vouchers_id, vouchers_name, voucers_detil_id, orders_amount, orders_amount_real, orders_amount_addons, orders_amount_ongkir, orders_amount_ongkir_frozen, orders_pax, orders_pax_addons150, orders_pax_addons100, orders_kode_unik, voucers_amount, orders_potongan_saldo, orders_notes, orders_payment_method, utm_source, bank_id, ms_penerima, ms_notelp, ms_detail, kelurahan_id, kelurahan_text, orders_from_admin, image_pembayaran_url, image_pembayaran_mime, orders_date_created, orders_is_deleted, bank_code, orders_id_migrasi, orders_ongkir_noncatering, orders_pax_frozeen, orders_amount_ongkir_paxel, orders_amount_ongkir_mrspeedy, orders_amount_ongkir_jne, admin_id, ms_id, ms_nama, members_id_merge,tax_value,total_pajak,'`+functions.sanitizeString(date_now)+`' as orders_date_insert,voucher_amount_ongkir,orders_pax_mm,orders_pax_addons_mm,orders_amount_addons_mm FROM orders_cart WHERE orders_nomor = '`+ order_id + `'`;

                console.log('Query insert Orders : ' + $q);
                connection = await connSentral.getConnection();
                empResult = await connection.executeQuery($q);
                connection.close();
                var ordersID = 0; // dari table orders
                if (typeof empResult == 'undefined') {
                    var returnData = JSON.stringify({ status: false, message: 'Insert Orders Error' });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(returnData);
                    return false;
                }

                ordersID = parseInt(empResult.insertId);

                // get data orders and shopping cart untuk insert ke table orders detail
                $q = `SELECT *,plan_category.plan_is_jadwal,plan_category.plan_is_npd,plan_category.plan_separate_shipment FROM orders_cart
                    LEFT JOIN shopping_cart ON shopping_cart.orders_id_cart = orders_cart.orders_id
                    LEFT JOIN plan ON plan.plan_id = shopping_cart.plan_id
                    left join plan_category on plan.plan_category_id = plan_category.plan_category_id
                    WHERE orders_nomor = '`+ order_id + `'`;
                console.log('Query : ' + $q);
                connection = await connSentral.getConnection();
                dataDetailCart = await connection.executeQuery($q);
                connection.close();
                if (typeof empResult == 'undefined') {
                    var returnData = JSON.stringify({ status: false, message: 'Get Data order cart Error' });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(returnData);
                    return false;
                }

                var shopping_cart_id = 0;
                var members_id = 0;

                var ms_id_;
                var ms_nama_;
                var ms_penerima_;
                var ms_notelp_;
                var ms_detail_;
                var kelurahan_id_;
                var kelurahan_text_;
                var hub_id_;

                var plan_category_id;
                var plan_is_jadwal;
                var plan_is_npd;
                var plan_separate_shipment;

                var dataInsertDetailFinal = [];

                var cutoff_hari_catering  = 2;
                var cutoff_jam_catering  = "14:00:00";

                var cutoff_hari_frozen  = 3;
                var cutoff_jam_frozen  = "14:00:00";

                //mini meals
                let cutoff_jam_mm = "14:00:00";
                let cutoff_hari_mm = 2;

                var $q_config = `SELECT config_harga_addons100, config_harga_addons150,config_min_hari_transaksi as min_catering,
                            config_cutoff as jam_catering,config_min_hari_frozen as min_frozen,
                            config_cutoff_frozen as jam_frozen, config_quota_is_active, config_quota_catering,config_quota_frozen,config_harga_addons_mm as harga_addons_mm,config_cutoff_mm as jam_mm, config_min_hari_mm as min_mm,config.config_quota_mm FROM config where config_id = '1'`;
                connection = await connSentral.getConnection();
                var listConfig = await connection.executeQuery($q_config);
                connection.close();

                if(typeof listConfig[0]['min_catering'] != 'undefined'){
                    cutoff_hari_catering = listConfig[0]['min_catering'];
                }

                if(typeof listConfig[0]['jam_catering'] != 'undefined'){
                    cutoff_jam_catering = listConfig[0]['jam_catering'];
                }
                if(typeof listConfig[0]['min_frozen'] != 'undefined'){
                    cutoff_hari_frozen = listConfig[0]['min_frozen'];
                }

                if(typeof listConfig[0]['jam_frozen'] != 'undefined'){
                    cutoff_jam_frozen = listConfig[0]['jam_frozen'];
                }

                //mini meals

                if(typeof listConfig[0]['jam_mm'] != 'undefined'){
                    cutoff_jam_mm = listConfig[0]['jam_mm'];
                }

                if(typeof listConfig[0]['min_mm'] != 'undefined'){
                    cutoff_hari_mm = listConfig[0]['min_mm'];
                }

                //ambil cutoff catering
                var cutoff_catering_final = functions.addDays(date_now,cutoff_hari_catering);
                var cutoff_catering_final2 = functions.formatDate(cutoff_catering_final)+ " " + cutoff_jam_catering;

                let where_catering = ` and cart_date_kirim >= '`+functions.formatDate(cutoff_catering_final)+`'`;
                if(cutoff_catering_final > cutoff_catering_final2){
                    where_catering = ` and cart_date_kirim > '`+functions.formatDate(cutoff_catering_final)+`'`;
                }


                let cutoff_mm_final = functions.addDays(date_now,cutoff_hari_mm);
                let cutoff_mm_final2 = functions.formatDate(cutoff_mm_final)+ " " + cutoff_jam_mm;

                let where_mm = ` and cart_date_kirim >= '`+functions.formatDate(cutoff_mm_final)+`'`;
                if(cutoff_mm_final > cutoff_mm_final2){
                    where_mm = ` and cart_date_kirim > '`+functions.formatDate(cutoff_mm_final)+`'`;
                }

                if (true) {

                    if (dataDetailCart.length > 0) {
                        for (let index = 0; index < dataDetailCart.length; index++) {
                            row = dataDetailCart[index];
                            // empResult.forEach(function (row) {

                            shopping_cart_id = row.shopping_cart_id;
                            members_id = row.members_id;

                            ms_id_ = row.ms_id;
                            ms_nama_ = row.ms_nama_;
                            ms_penerima_ = row.ms_penerima_;
                            ms_notelp_ = row.ms_notelp_;
                            ms_detail_ = row.ms_detail_;
                            kelurahan_id_ = row.kelurahan_id_;
                            kelurahan_text_ = row.kelurahan_text_;
                            hub_id_ = row.hub_id;

                            if (typeof ms_nama_ == 'undefined') {
                                ms_nama_ = ' ';
                            }
                            if (typeof ms_penerima_ == 'undefined') {
                                ms_penerima_ = ' ';
                            }
                            if (typeof ms_notelp_ == 'undefined') {
                                ms_notelp_ = '0';
                            }
                            if (typeof ms_detail_ == 'undefined') {
                                ms_detail_ = ' ';
                            }
                            if (typeof kelurahan_text_ == 'undefined') {
                                kelurahan_text_ = ' ';
                            }

                            if (typeof kelurahan_id_ == 'undefined') {
                                kelurahan_id_ = '0';
                            }
                            if (typeof hub_id_ == 'undefined') {
                                hub_id_ = '0';
                            }

                            plan_category_id = row.plan_category_id;
                            plan_is_jadwal = row.plan_is_jadwal;
                            plan_is_npd = row.plan_is_npd;
                            plan_separate_shipment = row.plan_separate_shipment;

                            // console.log("=================================");
                            // console.log(plan_category_id);
                            // console.log("=================================");

                            var is_frozen = 0;
                            if (plan_category_id == 2) {
                                is_frozen = 1;
                            }

                            let harga_normal = row.plan_price_real;
                            let harga_dipakai = row.plan_price_real;
                            if(row.plan_price_fake > 0){
                                harga_dipakai = row.plan_price_fake
                            }
                            let selisih_harga = harga_normal - harga_dipakai;
                            let grand_total = harga_dipakai * row.qty;

                            // Insert Detail
                            var dataInsertDetail = [
                                ordersID,
                                row.plan_id,
                                is_frozen,
                                row.qty,
                                row.ms_id,
                                row.note,
                                harga_normal,
                                harga_dipakai,
                                selisih_harga,
                                grand_total
                            ];

                            // dataInsertDetailFinal.push(dataInsertDetail);

                            $q = `INSERT INTO orders_detil (orders_id, plan_id, is_frozen, qty, ms_id, note,harga_normal,harga_dipakai,selisih_harga,grand_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
                            // (async () => {
                            console.log('Query Insert : ' + $q);
                            connection = await connSentral.getConnection();
                            rInsert1 = await connection.executeQuery($q, dataInsertDetail);
                            connection.close();
                            // })();


                            if (typeof rInsert1 == 'undefined') {
                                var returnData = JSON.stringify({ status: false, message: 'Insert Order Detail Error' });
                                res.setHeader('Content-Type', 'application/json');
                                res.send(returnData);
                                return false;
                            }
                            // End

                            let orders_id = ordersID;

                            $q = `SELECT * FROM orders WHERE orders_id = '` + orders_id + `'`;
                            var connection = await connSentral.getConnection();
                            let isiOrder = await connection.executeQuery($q);
                            connection.close();

                            if (typeof isiOrder == 'undefined') {
                                var returnData = JSON.stringify({ status: false, message: 'Orders Id Not found' });
                                res.setHeader('Content-Type', 'application/json');
                                res.send(returnData);
                                return false;
                            }

                            $q = `SELECT * FROM orders_detil WHERE orders_id = '` + orders_id + `'`;
                            var connection = await connSentral.getConnection();
                            let orderDetail = await connection.executeQuery($q);
                            connection.close();

                            if (typeof orderDetail == 'undefined') {
                                var returnData = JSON.stringify({ status: false, message: 'Orders Detail Not found' });
                                res.setHeader('Content-Type', 'application/json');
                                res.send(returnData);
                                return false;
                            }

                            let orderData = isiOrder[0];

                            let totalHargaNormal = 0;
                            let totalHargaProduk = 0;
                            if(orderDetail.length > 0){
                                for (let index = 0; index < orderDetail.length; index++) {
                                    let tmp_harga_produk = 0;
                                    let tmp_harga_normal = 0;

                                    const element = orderDetail[index];
                                    let harga_normal = element.harga_normal;
                                    let harga_dipakai = element.harga_dipakai;
                                    let qty = element.qty;

                                    tmp_harga_normal = harga_normal * qty;
                                    tmp_harga_produk = harga_dipakai * qty;

                                    totalHargaNormal += tmp_harga_normal;
                                    totalHargaProduk += tmp_harga_produk;

                                }
                            }

                            let orders_amount_selisih = totalHargaNormal - totalHargaProduk;

                            let orders_ongkir_all = orderData.orders_amount_ongkir + orderData.orders_ongkir_noncatering + orderData.orders_amount_ongkir_mm + orderData.orders_amount_ongkir_frozen;
                            let subtotal_produk = totalHargaProduk + orderData.orders_amount_addons + orderData.orders_amount_addons_mm -  orderData.voucers_amount - orderData.orders_potongan_saldo;
                            let total_pajak = subtotal_produk * (orderData.tax_value/100);
                            let subtotal_ongkir = orders_ongkir_all - orderData.voucher_amount_ongkir - orderData.orders_disc_ongkir;

                            let grand_total_all = subtotal_produk + total_pajak + subtotal_ongkir;

                            var qUpdate = `UPDATE orders SET orders_harga_produk = '` + Math.round(totalHargaProduk) + `', orders_harga_normal = '` + Math.round(totalHargaNormal) + `', orders_amount_selisih = '` + Math.round(orders_amount_selisih) + `', voucers_amount = '`+Math.round(orderData.voucers_amount)+`', orders_potongan_saldo = '` + Math.round(orderData.orders_potongan_saldo) + `', subtotal_produk = '` + Math.round(subtotal_produk) + `', total_pajak = '` + Math.round(total_pajak) + `', orders_ongkir_all = '`+Math.round(orders_ongkir_all)+`', voucher_amount_ongkir = '` + Math.round(orderData.voucher_amount_ongkir) + `', orders_disc_ongkir = '` + Math.round(orderData.orders_disc_ongkir) + `', subtotal_ongkir = '` + Math.round(subtotal_ongkir) + `', grand_total = '`+Math.round(grand_total_all)+`' WHERE orders_id = '` + orders_id + `'`;

                            console.log(qUpdate);
                            var connection = await connSentral.getConnection();
                            var updateResult = await connection.executeQuery(qUpdate);
                            connection.close();



                            if(parseInt(plan_is_jadwal) == 1){
                                if (parseInt(plan_category_id) == 1) {
                                    // punya catering

                                    // Get Data Catering
                                    var dataCatering;
                                    $q = `SELECT * FROM cart_jadwal_menu WHERE shopping_cart_id = '` + shopping_cart_id + `' and members_id = '` + members_id + `' ` + where_catering;
                                    // (async () => {
                                    // console.log('Query : ' + $q);
                                    connection = await connSentral.getConnection();
                                    dataCatering = await connection.executeQuery($q);
                                    connection.close();
                                    // })();


                                    if (typeof dataCatering == 'undefined') {
                                        var returnData = JSON.stringify({ status: false, message: 'Get Data Cart Catering Error' });
                                        res.setHeader('Content-Type', 'application/json');
                                        res.send(returnData);
                                        return false;
                                    }

                                    var dataInsertCatering;
                                    if (dataCatering.length > 0) {
                                        for (let idx1 = 0; idx1 < dataCatering.length; idx1++) {
                                            rowCatring = dataCatering[idx1];
                                            // dataCatering.forEach(function (rowCatring) {

                                            dataInsertCatering = [
                                                rowCatring.members_id,
                                                functions.formatDate(rowCatring.cart_date_kirim),
                                                rowCatring.cart_pilihan_menu,
                                                rowCatring.cart_addons,
                                                '1',
                                                rowCatring.token_addons150,
                                                rowCatring.token_addons100,
                                                rowCatring.ms_id,
                                                rowCatring.ms_nama,
                                                rowCatring.ms_penerima,
                                                rowCatring.ms_notelp,
                                                rowCatring.ms_detail,
                                                rowCatring.kelurahan_id,
                                                rowCatring.kelurahan_text,
                                                rowCatring.hub_id,
                                                functions.dateNow().toString(),
                                                rowCatring.note
                                            ];

                                            $q = `INSERT INTO orders_jadwal_menu
                                        (members_id, orders_date_kirim, orders_pilihan_menu,orders_addons, status, token_addons150, token_addons100, ms_id, ms_nama, ms_penerima, ms_notelp, ms_detail, kelurahan_id, kelurahan_text, hub_id, orders_jadwal_menu_date_insert,note)
                                        VALUES
                                        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                        `;

                                            var rInsertCatering;
                                            // (async () => {
                                            // console.log('Query Insert : ' + $q);
                                            connection = await connSentral.getConnection();
                                            rInsertCatering = await connection.executeQuery($q, dataInsertCatering);
                                            connection.close();
                                            // })();

                                            if (typeof rInsertCatering == 'undefined') {
                                                var returnData = JSON.stringify({ status: false, message: 'Insert Catering Schedule Error' });
                                                res.setHeader('Content-Type', 'application/json');
                                                res.send(returnData);
                                                return false;
                                            }

                                        }
                                    }
                                    // End
                                }

                                if (parseInt(plan_category_id) == 2) {

                                    var dataFrozen;
                                    $q = `SELECT * FROM cart_jadwal_frozen WHERE shopping_cart_id = '` + shopping_cart_id + `' and members_id = '` + members_id + `'`;
                                    // (async () => {
                                    // console.log('Query : ' + $q);
                                    connection = await connSentral.getConnection();
                                    dataFrozen = await connection.executeQuery($q);
                                    connection.close();
                                    // })();

                                    if (typeof dataFrozen == 'undefined') {
                                        var returnData = JSON.stringify({ status: false, message: 'Get Data Cart Frozen Error' });
                                        res.setHeader('Content-Type', 'application/json');
                                        res.send(returnData);
                                        return false;
                                    }

                                    var dataInsertFrozen;
                                    if (dataFrozen.length > 0) {
                                        for (let idx2 = 0; idx2 < dataFrozen.length; idx2++) {
                                            rowFrozen = dataFrozen[idx2]
                                            // dataFrozen.forEach(function (rowFrozen) {

                                            dataInsertFrozen = [
                                                ordersID,
                                                rowFrozen.members_id,
                                                functions.formatDate(rowFrozen.cart_date_kirim),
                                                rowFrozen.cart_pilihan_menu,
                                                functions.dateNow().toString(),
                                                rowFrozen.ms_id,
                                                rowFrozen.ms_nama,
                                                rowFrozen.ms_penerima,
                                                rowFrozen.ms_notelp,
                                                rowFrozen.ms_detail,
                                                rowFrozen.kelurahan_id,
                                                rowFrozen.kelurahan_text,
                                                rowFrozen.note,
                                                'PAXEL'
                                            ];

                                            $q = `INSERT INTO orders_jadwal_frozen
                                        (orders_id, members_id, ojf_date_kirim, ojf_pilihan_menu, ojf_date_insert, ms_id, ms_nama, ms_penerima, ms_notelp, ms_detail, kelurahan_id, kelurahan_text, note,ojf_ekspedisi)
                                        VALUES
                                        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                        `;

                                            var rInsertFrozen;
                                            // (async () => {
                                            // console.log('Query Insert : ' + $q);
                                            connection = await connSentral.getConnection();
                                            rInsertFrozen = await connection.executeQuery($q, dataInsertFrozen);
                                            connection.close();
                                            // })();

                                            if (typeof rInsertFrozen == 'undefined') {
                                                var returnData = JSON.stringify({ status: false, message: 'Insert Frozen Schedule Error' });
                                                res.setHeader('Content-Type', 'application/json');
                                                res.send(returnData);
                                                return false;
                                            }
                                        }
                                    }
                                }

                                if (parseInt(plan_category_id) == 9) {
                                    // punya mini meals

                                    // Get Data Mini Meals
                                    var dataMiniMeals;
                                    $q = `SELECT * FROM cart_jadwal_mm WHERE shopping_cart_id = '` + shopping_cart_id + `' and members_id = '` + members_id + `' ` + where_mm;
                                    // (async () => {
                                    // console.log('Query : ' + $q);
                                    connection = await connSentral.getConnection();
                                    dataMiniMeals = await connection.executeQuery($q);
                                    connection.close();
                                    // })();


                                    if (typeof dataMiniMeals == 'undefined') {
                                        var returnData = JSON.stringify({ status: false, message: 'Get Data Cart Catering Error' });
                                        res.setHeader('Content-Type', 'application/json');
                                        res.send(returnData);
                                    }

                                    var dataInsertMiniMeals;
                                    if (dataMiniMeals.length > 0) {
                                        for (let idx1 = 0; idx1 < dataMiniMeals.length; idx1++) {
                                            rowCatring = dataMiniMeals[idx1];
                                            // dataCatering.forEach(function (rowCatring) {

                                            dataInsertMiniMeals = [
                                                rowCatring.members_id,
                                                functions.formatDate(rowCatring.cart_date_kirim),
                                                rowCatring.cart_pilihan_menu,
                                                rowCatring.cart_addons,
                                                '1',
                                                rowCatring.token_addons,
                                                rowCatring.ms_id,
                                                rowCatring.ms_nama,
                                                rowCatring.ms_penerima,
                                                rowCatring.ms_notelp,
                                                rowCatring.ms_detail,
                                                rowCatring.kelurahan_id,
                                                rowCatring.kelurahan_text,
                                                rowCatring.hub_id,
                                                functions.dateNow().toString(),
                                                rowCatring.note
                                            ];

                                            $q = `INSERT INTO orders_jadwal_mini_meals
                                        (members_id, ojmm_date_kirim, ojmm_pilihan_menu,ojmm_addons, status, token_addons, ms_id, ms_nama, ms_penerima, ms_notelp, ms_detail, kelurahan_id, kelurahan_text, hub_id, ojmm_date_insert,note)
                                        VALUES
                                        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                        `;

                                            var rInsertMiniMeals;
                                            // (async () => {
                                            // console.log('Query Insert : ' + $q);
                                            connection = await connSentral.getConnection();
                                            rInsertMiniMeals = await connection.executeQuery($q, dataInsertMiniMeals);
                                            connection.close();
                                            // })();

                                            if (typeof rInsertMiniMeals == 'undefined') {
                                                var returnData = JSON.stringify({ status: false, message: 'Insert Mini Meals Schedule Error' });
                                                res.setHeader('Content-Type', 'application/json');
                                                res.send(returnData);
                                            }

                                        }
                                    }
                                    // End
                                }
                            }else{
                                if (parseInt(plan_category_id) == 4) {
                                    // punya bundle

                                    // $q = `SELECT * FROM plan_bundle
                                    // LEFT JOIN plan ON plan.plan_id = plan_bundle.plan_id_parent
                                    // WHERE plan_id_parent = '`+row.plan_id+`';
                                    // `;

                                    $q = `SELECT plan.plan_category_id,plan.plan_id,plan_is_jadwal,plan_is_npd,plan_separate_shipment FROM plan_bundle
                                        LEFT JOIN plan ON plan.plan_id = plan_bundle.plan_id
                                        left join plan_category on plan.plan_category_id = plan_category.plan_category_id
                                        WHERE plan_id_parent = '`+ row.plan_id + `'`;

                                    var resultDetailBundle;
                                    // console.log('Query : ' + $q);
                                    connection = await connSentral.getConnection();
                                    resultDetailBundle = await connection.executeQuery($q);
                                    connection.close();

                                    if (typeof resultDetailBundle == 'undefined') {
                                        var returnData = JSON.stringify({ status: false, message: 'Get Data Bundle Error Error' });
                                        res.setHeader('Content-Type', 'application/json');
                                        res.send(returnData);
                                        return false;
                                    }

                                    var categoryPlanBundle = 0;
                                    var isJadwalPlanBundle = 0;
                                    var isNPDPlanBundle = 0;
                                    var isSeparateshipmentPlanBundle = 0;
                                    if (resultDetailBundle.length > 0) {
                                        var jumlah_rte_bundling = 0
                                        for (let idx3 = 0; idx3 < resultDetailBundle.length; idx3++) {
                                            rowDetailBundle = resultDetailBundle[idx3];
                                            categoryPlanBundle = rowDetailBundle.plan_category_id;
                                            isJadwalPlanBundle = rowDetailBundle.plan_is_jadwal;
                                            isNPDPlanBundle = rowDetailBundle.plan_is_npd;
                                            isSeparateshipmentPlanBundle = rowDetailBundle.plan_separate_shipment;
                                            planIDIsiBundle = rowDetailBundle.plan_id;

                                            if(isJadwalPlanBundle == 1){
                                                if (parseInt(categoryPlanBundle) == 1) {
                                                    // punya catering

                                                    // Get Data Catering
                                                    var dataCatering2;
                                                    $q = `SELECT * FROM cart_jadwal_menu WHERE shopping_cart_id = '` + shopping_cart_id + `' and members_id = '` + members_id + `' ` + where_catering;
                                                    // (async () => {
                                                    // console.log('Query Catering Bundlue: ' + $q);
                                                    connection = await connSentral.getConnection();
                                                    dataCatering2 = await connection.executeQuery($q);
                                                    connection.close();
                                                    // })();


                                                    if (typeof dataCatering2 == 'undefined') {
                                                        // console.log('MASUK ERROR');
                                                        var returnData = JSON.stringify({ status: false, message: 'Get Data Cart Catering Error' });
                                                        res.setHeader('Content-Type', 'application/json');
                                                        res.send(returnData);
                                                        return false;
                                                    }

                                                    var dataInsertCatering;
                                                    if (dataCatering2.length > 0) {
                                                        for (let idx4 = 0; idx4 < dataCatering2.length; idx4++) {
                                                            rowCatring = dataCatering2[idx4];
                                                            // dataCatering.forEach(function (rowCatring) {

                                                            if(idx3 > 0){
                                                                break;
                                                            }

                                                            dataInsertCatering = [
                                                                rowCatring.members_id,
                                                                functions.formatDate(rowCatring.cart_date_kirim),
                                                                rowCatring.cart_pilihan_menu,
                                                                rowCatring.cart_addons,
                                                                '1',
                                                                rowCatring.token_addons150,
                                                                rowCatring.token_addons100,
                                                                rowCatring.ms_id,
                                                                rowCatring.ms_nama,
                                                                rowCatring.ms_penerima,
                                                                rowCatring.ms_notelp,
                                                                rowCatring.ms_detail,
                                                                rowCatring.kelurahan_id,
                                                                rowCatring.kelurahan_text,
                                                                rowCatring.hub_id,
                                                                functions.dateNow().toString(),
                                                                rowCatring.note
                                                            ];


                                                            $q = `INSERT INTO orders_jadwal_menu
                                                            (members_id, orders_date_kirim, orders_pilihan_menu,orders_addons, status, token_addons150, token_addons100, ms_id, ms_nama, ms_penerima, ms_notelp, ms_detail, kelurahan_id, kelurahan_text, hub_id, orders_jadwal_menu_date_insert,note)
                                                            VALUES
                                                            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                                            `;

                                                            var rInsertCatering;
                                                            // (async () => {
                                                            // console.log('Query Insert : ' + $q);
                                                            connection = await connSentral.getConnection();
                                                            rInsertCatering = await connection.executeQuery($q, dataInsertCatering);
                                                            connection.close();
                                                            // })();

                                                            if (typeof rInsertCatering == 'undefined') {
                                                                var returnData = JSON.stringify({ status: false, message: 'Insert Catering Schedule Error' });
                                                                res.setHeader('Content-Type', 'application/json');
                                                                res.send(returnData);
                                                                return false;
                                                            }

                                                        }
                                                    }
                                                    // End
                                                }

                                                if (parseInt(categoryPlanBundle) == 2) {

                                                    var dataFrozen;
                                                    $q = `SELECT * FROM cart_jadwal_frozen WHERE shopping_cart_id = '` + shopping_cart_id + `' and members_id = '` + members_id + `'`;
                                                    // (async () => {
                                                    // console.log('Query Frozen Bundlue: ' + $q);
                                                    connection = await connSentral.getConnection();
                                                    dataFrozen = await connection.executeQuery($q);
                                                    connection.close();
                                                    // })();

                                                    if (typeof dataFrozen == 'undefined') {
                                                        var returnData = JSON.stringify({ status: false, message: 'Get Data Cart Frozen Error' });
                                                        res.setHeader('Content-Type', 'application/json');
                                                        res.send(returnData);
                                                        return false;
                                                    }

                                                    var dataInsertFrozen;
                                                    if (dataFrozen.length > 0) {
                                                        for (let idx5 = 0; idx5 < dataFrozen.length; idx5++) {
                                                            rowFrozen = dataFrozen[idx5];
                                                            // dataFrozen.forEach(function (rowFrozen) {

                                                            dataInsertFrozen = [
                                                                ordersID,
                                                                rowFrozen.members_id,
                                                                functions.formatDate(rowFrozen.cart_date_kirim),
                                                                rowFrozen.cart_pilihan_menu,
                                                                functions.dateNow().toString(),
                                                                rowFrozen.ms_id,
                                                                rowFrozen.ms_nama,
                                                                rowFrozen.ms_penerima,
                                                                rowFrozen.ms_notelp,
                                                                rowFrozen.ms_detail,
                                                                rowFrozen.kelurahan_id,
                                                                rowFrozen.kelurahan_text,
                                                                rowFrozen.note,
                                                                'PAXEL'
                                                            ];

                                                            $q = `INSERT INTO orders_jadwal_frozen
                                                            (orders_id, members_id, ojf_date_kirim, ojf_pilihan_menu, ojf_date_insert, ms_id, ms_nama, ms_penerima, ms_notelp, ms_detail, kelurahan_id, kelurahan_text,note,ojf_ekspedisi)
                                                            VALUES
                                                            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                                            `;

                                                            var rInsertFrozen;
                                                            // (async () => {
                                                            // console.log('Query Insert : ' + $q);
                                                            connection = await connSentral.getConnection();
                                                            rInsertFrozen = await connection.executeQuery($q, dataInsertFrozen);
                                                            connection.close();
                                                            // })();

                                                            if (typeof rInsertFrozen == 'undefined') {
                                                                var returnData = JSON.stringify({ status: false, message: 'Insert Frozen Schedule Error' });
                                                                res.setHeader('Content-Type', 'application/json');
                                                                res.send(returnData);
                                                                return false;
                                                            }

                                                        }
                                                    }
                                                }

                                                if (parseInt(categoryPlanBundle) == 9) {
                                                    // punya Mini Meals

                                                    // Get Data Catering
                                                    var dataMiniMeals2;
                                                    $q = `SELECT * FROM cart_jadwal_mm WHERE shopping_cart_id = '` + shopping_cart_id + `' and members_id = '` + members_id + `' ` + where_catering;
                                                    // (async () => {
                                                    // console.log('Query Catering Bundlue: ' + $q);
                                                    connection = await connSentral.getConnection();
                                                    dataMiniMeals2 = await connection.executeQuery($q);
                                                    connection.close();
                                                    // })();


                                                    if (typeof dataMiniMeals2 == 'undefined') {
                                                        // console.log('MASUK ERROR');
                                                        var returnData = JSON.stringify({ status: false, message: 'Get Data Cart Catering Error' });
                                                        res.setHeader('Content-Type', 'application/json');
                                                        res.send(returnData);
                                                    }

                                                    var dataInsertMiniMeals;
                                                    if (dataMiniMeals2.length > 0) {
                                                        for (let idx1 = 0; idx1 < dataMiniMeals2.length; idx1++) {
                                                            rowCatring = dataMiniMeals2[idx1];
                                                            // dataCatering.forEach(function (rowCatring) {

                                                            dataInsertMiniMeals = [
                                                                rowCatring.members_id,
                                                                functions.formatDate(rowCatring.cart_date_kirim),
                                                                rowCatring.cart_pilihan_menu,
                                                                rowCatring.cart_addons,
                                                                '1',
                                                                rowCatring.token_addons,
                                                                rowCatring.ms_id,
                                                                rowCatring.ms_nama,
                                                                rowCatring.ms_penerima,
                                                                rowCatring.ms_notelp,
                                                                rowCatring.ms_detail,
                                                                rowCatring.kelurahan_id,
                                                                rowCatring.kelurahan_text,
                                                                rowCatring.hub_id,
                                                                functions.dateNow().toString(),
                                                                rowCatring.note
                                                            ];

                                                            $q = `INSERT INTO orders_jadwal_mini_meals
                                                        (members_id, ojmm_date_kirim, ojmm_pilihan_menu,ojmm_addons, status, token_addons, ms_id, ms_nama, ms_penerima, ms_notelp, ms_detail, kelurahan_id, kelurahan_text, hub_id, ojmm_date_insert,note)
                                                        VALUES
                                                        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                                        `;

                                                            var rInsertMiniMeals;
                                                            // (async () => {
                                                            // console.log('Query Insert : ' + $q);
                                                            connection = await connSentral.getConnection();
                                                            rInsertMiniMeals = await connection.executeQuery($q, dataInsertMiniMeals);
                                                            connection.close();
                                                            // })();

                                                            if (typeof rInsertMiniMeals == 'undefined') {
                                                                var returnData = JSON.stringify({ status: false, message: 'Insert Mini Meals Schedule Error' });
                                                                res.setHeader('Content-Type', 'application/json');
                                                                res.send(returnData);
                                                            }

                                                        }
                                                    }
                                                    // End
                                                }
                                            }else{
                                                var dataRTE;
                                                    $q = `SELECT * FROM cart_jadwal_produk WHERE shopping_cart_id = '` + shopping_cart_id + `' and plan_id = '`+functions.sanitizeString(planIDIsiBundle)+`' and members_id = '` + members_id + `'`;
                                                    console.log('Query : ' + $q);
                                                    connection = await connSentral.getConnection();
                                                    dataRTE = await connection.executeQuery($q);
                                                    connection.close();
                                                    console.log(dataRTE);

                                                    if (typeof dataRTE == 'undefined') {
                                                        var returnData = JSON.stringify({ status: false, message: 'Get Data Cart RTE Error' });
                                                        res.setHeader('Content-Type', 'application/json');
                                                        res.send(returnData);
                                                        return false;
                                                    }

                                                    var dataInsertRTE;
                                                    if (dataRTE.length > 0) {
                                                        for (let idx2 = 0; idx2 < dataRTE.length; idx2++) {
                                                            rowRTE = dataRTE[idx2];
                                                            console.log(rowRTE);
                                                            // dataFrozen.forEach(function (rowFrozen) {

                                                            dataInsertRTE = [
                                                                ordersID,
                                                                rowRTE.members_id,
                                                                rowRTE.ms_id,
                                                                rowRTE.ms_nama,
                                                                rowRTE.ms_penerima,
                                                                rowRTE.ms_notelp,
                                                                rowRTE.ms_detail,
                                                                rowRTE.kelurahan_id,
                                                                rowRTE.kelurahan_text,
                                                                rowRTE.plan_id,
                                                                rowRTE.ojp_berat,
                                                                rowRTE.ojp_dimensi,
                                                                rowRTE.ojp_ekspedisi,
                                                                rowRTE.qty,
                                                                rowRTE.note,
                                                                rowRTE.plan_separate_shipment
                                                            ];
                                                            dataInsertRTE.push("0000-00-00 00:00:00");

                                                            console.log('AAAAAAAAAAAAAA');
                                                            console.log(dataInsertRTE);
                                                            console.log('BBBBBBBBBBBBBBBB');

                                                            $q = `INSERT INTO orders_jadwal_produk
                                                                (orders_id, members_id, ms_id, ms_nama, ms_penerima, ms_notelp, ms_detail, kelurahan_id, kelurahan_text, plan_id, ojp_berat, ojp_dimensi, ojp_ekspedisi, qty,note,plan_separate_shipment,ojp_date_kirim)
                                                                VALUES
                                                                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                                                `;

                                                            var rInsertRTE;
                                                            // (async () => {
                                                            console.log('Query Insert : ' + $q);
                                                            connection = await connSentral.getConnection();
                                                            rInsertRTE = await connection.executeQuery($q, dataInsertRTE);
                                                            connection.close();
                                                            // })();

                                                            if (typeof rInsertRTE == 'undefined') {
                                                                var returnData = JSON.stringify({ status: false, message: 'Insert RTE Schedule Error' });
                                                                res.setHeader('Content-Type', 'application/json');
                                                                res.send(returnData);
                                                                return false;
                                                            }

                                                            //insert History
                                                            $q = `SELECT plan_id, plan_qty FROM plan_bundle WHERE plan_id_parent = '` + row.plan_id + `' and plan_id = '`+rowRTE.plan_id+`'`;
                                                            console.log('Query : ' + $q);
                                                            connection = await connSentral.getConnection();
                                                            dataProdukBundling = await connection.executeQuery($q);
                                                            connection.close();
                                                            console.log("-------------------");
                                                            console.log(dataProdukBundling);

                                                            if (typeof dataProdukBundling != 'undefined') {
                                                                if (dataProdukBundling.length > 0) {
                                                                    for (let idx3 = 0; idx3 < dataProdukBundling.length; idx3++) {
                                                                        rowProdukBundling = dataProdukBundling[idx3];

                                                                        qty_stok_dikurangi = parseInt(rowRTE.qty);
                                                                        console.log(rowProdukBundling.plan_qty + " <<<<< qty bundling");
                                                                        console.log(rowRTE.qty + " <<<<< qty rte");

                                                                        qty_dikurangi = parseInt(qty_stok_dikurangi) * -1;

                                                                        var dataInsertHistory = [
                                                                            rowProdukBundling.plan_id,
                                                                            qty_dikurangi,
                                                                            functions.sanitizeString(date_now)
                                                                        ];
                                                                        dataInsertHistory.push("Pengurangan stok karena penjualan Order ID : " + ordersID);

                                                                        $q = `INSERT INTO history_stok_produk
                                                                    (plan_id, hsp_jumlah,hsp_date_insert, keterangan)
                                                                    VALUES
                                                                    (?, ?, ?, ?)
                                                                    `;


                                                                        console.log(dataInsertHistory);
                                                                        connection = await connSentral.getConnection();
                                                                        var rInsertHistory = await connection.executeQuery($q, dataInsertHistory);
                                                                        connection.close();

                                                                        if (typeof rInsertHistory == 'undefined') {
                                                                            var returnData = JSON.stringify({ status: false, message: 'Insert History RTE Error' });
                                                                            res.setHeader('Content-Type', 'application/json');
                                                                            res.send(returnData);
                                                                            return false;
                                                                        }

                                                                        //update stock
                                                                        var qUpdate = `update plan set plan_stock_noncatering = (plan_stock_noncatering + (-` + functions.sanitizeString(qty_stok_dikurangi) + `)) where plan_id = '` + functions.sanitizeString(rowProdukBundling.plan_id) + `'`;
                                                                        connection = await connSentral.getConnection();
                                                                        updateResult = await connection.executeQuery(qUpdate);
                                                                        connection.close();
                                                                    }
                                                                }
                                                            }



                                                        }
                                                    }
                                            }

                                        }
                                    }

                                }else{
                                    var dataRTE;
                                    $q = `SELECT * FROM cart_jadwal_produk WHERE shopping_cart_id = '` + shopping_cart_id + `' and members_id = '` + members_id + `'`;
                                    console.log('Query : ' + $q);
                                    connection = await connSentral.getConnection();
                                    dataRTE = await connection.executeQuery($q);
                                    connection.close();

                                    if (typeof dataRTE == 'undefined') {
                                        var returnData = JSON.stringify({ status: false, message: 'Get Data Cart RTE Error' });
                                        res.setHeader('Content-Type', 'application/json');
                                        res.send(returnData);
                                        return false;
                                    }

                                    var dataInsertRTE;
                                    if (dataRTE.length > 0) {
                                        for (let idx2 = 0; idx2 < dataRTE.length; idx2++) {
                                            rowRTE = dataRTE[idx2]
                                            // dataFrozen.forEach(function (rowFrozen) {

                                            dataInsertRTE = [
                                                ordersID,
                                                rowRTE.members_id,
                                                rowRTE.ms_id,
                                                rowRTE.ms_nama,
                                                rowRTE.ms_penerima,
                                                rowRTE.ms_notelp,
                                                rowRTE.ms_detail,
                                                rowRTE.kelurahan_id,
                                                rowRTE.kelurahan_text,
                                                rowRTE.plan_id,
                                                rowRTE.ojp_berat,
                                                rowRTE.ojp_dimensi,
                                                rowRTE.ojp_ekspedisi,
                                                rowRTE.qty,
                                                rowRTE.note,
                                                rowRTE.plan_separate_shipment
                                            ];
                                            dataInsertRTE.push("0000-00-00 00:00:00");

                                            $q = `INSERT INTO  orders_jadwal_produk
                                            (orders_id, members_id, ms_id, ms_nama, ms_penerima, ms_notelp, ms_detail, kelurahan_id, kelurahan_text, plan_id, ojp_berat, ojp_dimensi, ojp_ekspedisi, qty,note,plan_separate_shipment,ojp_date_kirim)
                                            VALUES
                                            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                            `;

                                            var rInsertRTE;
                                            // (async () => {
                                            console.log('Query Insert : ' + $q);
                                            connection = await connSentral.getConnection();
                                            rInsertRTE = await connection.executeQuery($q, dataInsertRTE);
                                            connection.close();
                                            // })();

                                            if (typeof rInsertRTE == 'undefined') {
                                                var returnData = JSON.stringify({ status: false, message: 'Insert RTE Schedule Error' });
                                                res.setHeader('Content-Type', 'application/json');
                                                res.send(returnData);
                                                return false;
                                            }

                                            //insert History

                                            qty_dikurangi = parseInt(rowRTE.qty) * -1;

                                            var dataInsertHistory = [
                                                rowRTE.plan_id,
                                                qty_dikurangi,
                                                functions.sanitizeString(date_now)
                                            ];
                                            dataInsertHistory.push("Pengurangan stok karena penjualan Order ID : " + ordersID);

                                            $q = `INSERT INTO history_stok_produk
                                        (plan_id, hsp_jumlah,hsp_date_insert, keterangan)
                                        VALUES
                                        (?, ?, ?, ?)
                                        `;
                                            connection = await connSentral.getConnection();
                                            var rInsertHistory = await connection.executeQuery($q, dataInsertHistory);
                                            connection.close();

                                            if (typeof rInsertHistory == 'undefined') {
                                                var returnData = JSON.stringify({ status: false, message: 'Insert History RTE Error' });
                                                res.setHeader('Content-Type', 'application/json');
                                                res.send(returnData);
                                                return false;
                                            }

                                            //update stock
                                            var qUpdate = `update plan set plan_stock_noncatering = (plan_stock_noncatering + (-` + functions.sanitizeString(rowRTE.qty) + `)) where plan_id = '` + functions.sanitizeString(rowRTE.plan_id) + `'`;
                                            connection = await connSentral.getConnection();
                                            var updateResult = await connection.executeQuery(qUpdate);
                                            connection.close();

                                        }
                                    }
                                }
                            }
                        }
                    }

                }

                var dataEmail;
                $q = `SELECT *, y.image_url as image_product,orders_cart.total_pajak,orders_cart.tax_value,shopping_cart.price_addon_mm,shopping_cart.price_addon,orders_cart.voucher_amount_ongkir FROM payment_partner
            LEFT JOIN members ON members.members_id = payment_partner.members_id
            LEFT JOIN orders_cart ON orders_cart.orders_nomor = payment_partner.invoice_id
            LEFT JOIN shopping_cart ON shopping_cart.orders_id_cart = orders_cart.orders_id
            LEFT JOIN plan ON plan.plan_id = shopping_cart.plan_id
            LEFT JOIN (SELECT MIN(plan_image_id), plan_id, image_url FROM plan_image GROUP BY plan_id) as y ON y.plan_id = plan.plan_id
            WHERE transaction_id = '`+ functions.sanitizeString(transaction_id) + `'`;
                console.log('Query : ' + $q);
                connection = await connSentral.getConnection();
                dataEmail = await connection.executeQuery($q);
                connection.close();
                if (typeof dataEmail == 'undefined') {
                    var returnData = JSON.stringify({ status: false, message: 'Get Data For Email Error' });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(returnData);
                    return false;
                }

                let dataMailer = {
                    email: '',
                    no_invoice: '',
                    tglorders: '',
                    membersname: '',
                    address: '',
                    subtotal: functions.formatRupiah(0),
                    shipping: functions.formatRupiah(0),
                    tax: functions.formatRupiah(0),
                    total: functions.formatRupiah(0),
                    plan: []
                }
                let listPlanEmail = [];

                if (dataEmail.length > 0) {
                    let x = 0;
                    dataEmail.forEach(function (row) {
                        var price_terpakai = 0;
                        if (parseInt(row.plan_price_fake) > 0) {
                            price_terpakai = row.plan_price_fake;
                        } else {
                            price_terpakai = row.plan_price_real;
                        }
                        x++;
                        if (x === 1) {
                            dataMailer = {
                                email: row.email,
                                no_invoice: row.orders_nomor,
                                tglorders: functions.formatDateMonth(row.orders_date_created),
                                membersname: row.firstname + ' ' + row.lastname,
                                bank_code: "GOPAY",
                                address1: row.ms_detail,
                                address2: row.kelurahan_text,
                                subtotal: functions.formatRupiah(row.orders_amount + row.voucers_amount + row.orders_amount_addons  + row.orders_amount_addons_mm),
                                potongan: functions.formatRupiah(row.voucers_amount),
                                tmp_harga: functions.formatRupiah(row.orders_amount + row.voucers_amount + row.orders_amount_addons + row.orders_amount_addons_mm - row.voucers_amount),
                                shipping: functions.formatRupiah(row.orders_amount_ongkir),
                                potongan_shipping: functions.formatRupiah(row.voucher_amount_ongkir),
                                subtotal_ongkir: functions.formatRupiah(row.orders_amount_ongkir - row.voucher_amount_ongkir),
                                tax: functions.formatRupiah(row.total_pajak),
                                tax_value: row.tax_value,
                                total: functions.formatRupiah(row.orders_amount + row.orders_amount_ongkir - row.voucher_amount_ongkir + row.orders_amount_addons + row.orders_amount_addons_mm + row.total_pajak),
                                plan: []
                            }
                        }

                        var textAddon = '';
                        if (parseInt(row.price_addon) > 0) {
                            textAddon = '( + addon ' + functions.formatRupiah(row.price_addon) + ' )';
                        }

                        var textAddonMM = '';
                        if (parseInt(row.price_addon_mm) > 0) {
                            textAddonMM = '( + addon ' + functions.formatRupiah(row.price_addon_mm) + ' )';
                        }

                        listPlanEmail.push({
                            'plan_image': row.image_product,
                            'plan_name': row.plan_name,
                            'plan_price': functions.formatRupiah(price_terpakai),
                            'plan_qty': row.qty,
                            'addon': textAddon,
                            'addon_mm': textAddonMM,
                            'plan_price_total': functions.formatRupiah((price_terpakai * row.qty) + row.price_addon + row.price_addon_mm)
                        });
                    });
                    dataMailer.plan = listPlanEmail;

                    (async () => {
                        let msg_id = await mailerMod.PaymentSuccess(dataMailer);
                        console.log(msg_id);
                    })();
                }

                returnData = JSON.stringify({ status: true, message: 'Midtarans Payment Successfully.' });
                res.setHeader('Content-Type', 'application/json');
                res.send(returnData);


            } else {
                // payment sukses instant delivery
                var order_nomor_grouu = dataPayment_.invoice_id;

                 // step untuk cek apakah no invoice udah ada (belum)

                // get data orders cart instant delivery
                // get data detail orders cart instant
                // insert orders cart ke orders punya outlet dan instert detailnya

                var Q = "SELECT * FROM orders_cart_instant WHERE orders_nomor = '"+order_nomor_grouu+"'";
                connection = await connSentral.getConnection();
                var cartOrder = await connection.executeQuery(Q);
                connection.close();

                if (typeof cartOrder == 'undefined') {
                    var returnData = JSON.stringify({ status: false, message: 'Get Data Cart Orders Error' });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(returnData);
                    return false;
                }
                if (typeof cartOrder.length < 0) {
                    var returnData = JSON.stringify({ status: false, message: 'Get Data Cart Orders Not Found' });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(returnData);
                    return false;
                }

                cartOrder = cartOrder[0];

                var Q = "SELECT * FROM orders_detail_cart_instant WHERE orders_id = '"+cartOrder.orders_id+"'";
                connection = await connSentral.getConnection();
                var cartOrderDetail = await connection.executeQuery(Q);
                connection.close();

                if (typeof cartOrderDetail == 'undefined') {
                    var returnData = JSON.stringify({ status: false, message: 'Get Data Cart Detail Orders Error' });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(returnData);
                    return false;
                }
                if (typeof cartOrderDetail.length < 0) {
                    var returnData = JSON.stringify({ status: false, message: 'Get Data Cart  Detail Orders Not Found' });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(returnData);
                    return false;
                }

                var dataInsert = {
                    outlet_id: cartOrder.outlet_id,
                    orders_nomor: cartOrder.orders_nomor,
                    members_id: cartOrder.members_id,
                    members_name: cartOrder.members_name,
                    members_notelp: cartOrder.members_notelp,
                    orders_status: cartOrder.orders_status,
                    date_orders: cartOrder.date_orders,
                    date_insert: cartOrder.date_insert,
                    channel_nama: cartOrder.channel_nama,
                    orders_from_website: cartOrder.orders_from_website,
                    ms_id: cartOrder.ms_id,
                    ms_penerima: cartOrder.ms_penerima,
                    ms_notelp: cartOrder.ms_notelp,
                    ms_detail: cartOrder.ms_detail,
                    latitude: cartOrder.latitude,
                    longitude: cartOrder.longitude,
                    note: cartOrder.note,
                    harga_produk: cartOrder.harga_produk,
                    harga_ongkir: cartOrder.harga_ongkir,
                    tax: cartOrder.tax,
                    tax_value: cartOrder.tax_value,
                    potongan_harga: cartOrder.potongan_harga,
                    grand_total: cartOrder.grand_total,
                    vouchers_id: cartOrder.vouchers_id,
                    vouchers_name: cartOrder.vouchers_name,
                    voucers_detil_id: cartOrder.voucers_detil_id,
                    orders_payment_method: cartOrder.orders_payment_method,
                    bank_code: cartOrder.bank_code,
                    detail: []
                }
                var dataInsertDetail = [];
                for (let index = 0; index < cartOrderDetail.length; index++) {
                    const cartOrderDetail_ = cartOrderDetail[index];
                    dataInsertDetail.push({
                        plan_id: cartOrderDetail_.plan_id,
                        resep_id: cartOrderDetail_.resep_id,
                        stage: cartOrderDetail_.stage,
                        nama_produk: cartOrderDetail_.nama_produk,
                        harga_satuan: cartOrderDetail_.harga_satuan,
                        grand_total: cartOrderDetail_.grand_total,
                        qty: cartOrderDetail_.qty,
                        note: cartOrderDetail_.note
                    });
                }

                dataInsert.detail = dataInsertDetail;

                console.log('++ payment instant delivery ++');
                console.log(dataInsert);

                var username = "grouu";
                var password = "shiny-shiny-password";
                var auth = functions.base64_encode(username + ':' + password);

                var URL = anything.outletAPIphp + 'create_order.php';
                const response = await fetch(URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + auth,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dataInsert)
                });

                console.log('Basic ' + auth);
                console.log(JSON.stringify(dataInsert));

                var resultData = await response.json();

                console.log(resultData);

                var dataEmail;
                $q = `SELECT *, y.image_url as image_product,orders_cart_instant.tax as total_pajak,orders_cart_instant.tax_value,
                harga_produk as orders_amount,
                potongan_harga as voucers_amount,
                0 as orders_amount_addons,
                harga_ongkir as orders_amount_ongkir,
                tax as total_pajak,
                grand_total as orders_amount_real
                FROM payment_partner
                LEFT JOIN members ON members.members_id = payment_partner.members_id
                LEFT JOIN orders_cart_instant ON orders_cart_instant.orders_nomor = payment_partner.invoice_id
                LEFT JOIN shopping_cart_instant ON shopping_cart_instant.orders_id_cart = orders_cart_instant.orders_id
                LEFT JOIN plan ON plan.plan_id = shopping_cart_instant.plan_id
                LEFT JOIN (SELECT MIN(plan_image_id), plan_id, image_url FROM plan_image GROUP BY plan_id) as y ON y.plan_id = plan.plan_id
                WHERE transaction_id = '`+ functions.sanitizeString(transaction_id) + `'`;
                console.log('Query : ' + $q);
                connection = await connSentral.getConnection();
                dataEmail = await connection.executeQuery($q);
                connection.close();
                if (typeof dataEmail == 'undefined') {
                    var returnData = JSON.stringify({ status: false, message: 'Get Data For Email Error' });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(returnData);
                    return false;
                }

                let dataMailer = {
                    email: '',
                    no_invoice: '',
                    tglorders: '',
                    membersname: '',
                    address: '',
                    subtotal: functions.formatRupiah(0),
                    shipping: functions.formatRupiah(0),
                    tax: functions.formatRupiah(0),
                    total: functions.formatRupiah(0),
                    plan: []
                }
                let listPlanEmail = [];

                if (dataEmail.length > 0) {
                    let x = 0;
                    dataEmail.forEach(function (row) {
                        x++;
                        if (x === 1) {
                            dataMailer = {
                                email: row.email,
                                phone: row.phone,
                                no_invoice: row.orders_nomor,
                                tglorders: functions.formatDateMonth(row.orders_date_created),
                                membersname: row.firstname + ' ' + row.lastname,
                                bank_code: "GOPAY",
                                address1: row.ms_detail,
                                address2: row.kelurahan_text,
                                subtotal: functions.formatRupiah(row.orders_amount + row.voucers_amount + row.orders_amount_addons),
                                potongan: functions.formatRupiah(row.voucers_amount),
                                tmp_harga: functions.formatRupiah(row.orders_amount + row.voucers_amount + row.orders_amount_addons - row.voucers_amount),
                                shipping: functions.formatRupiah(row.orders_amount_ongkir),
                                potongan_shipping: functions.formatRupiah(0),
                                subtotal_ongkir: functions.formatRupiah(row.orders_amount_ongkir),
                                tax: functions.formatRupiah(row.total_pajak),
                                tax_value: row.tax_value,
                                total: functions.formatRupiah(row.orders_amount + row.orders_amount_ongkir + row.orders_amount_addons + row.total_pajak),
                                plan: []
                            }
                        }
                        listPlanEmail.push({
                            'plan_image': row.image_product,
                            'plan_name': row.plan_name,
                            'plan_price': functions.formatRupiah(row.plan_price_real),
                            'plan_qty': row.qty,
                            'addon': '',
                            'plan_price_total': functions.formatRupiah((row.plan_price_real * row.qty))
                        });
                    });
                    dataMailer.plan = listPlanEmail;

                    console.log(dataMailer);

                    (async () => {
                        let msg_id = await mailerMod.PaymentSuccess(dataMailer);
                        console.log(msg_id);
                    })();


                    // send email to outlet
                    var Q = "SELECT admin_email, outlet_name FROM db_outlet.admin LEFT JOIN outlet ON outlet.outlet_id = admin.outlet_id WHERE (ta_id = '2' OR ta_id = '4') and admin.outlet_id = '" + cartOrder.outlet_id + "'";
                    var connection = await connSentral.getConnection();
                    var dataEmail = await connection.executeQuery(Q);
                    connection.close();

                    for (let index = 0; index < dataEmail.length; index++) {
                        const element = dataEmail[index];

                        var email_outlet = element.admin_email;
                        var outlet_name = element.outlet_name;

                        let msg_id = await mailerMod.sendToOutlet(email_outlet, dataMailer.membersname, outlet_name, dataMailer.no_invoice, dataMailer.phone, functions.dateNow(), dataMailer.plan, dataMailer.total);
                        console.log(msg_id);
                    }

                    //push notification firebase outlet
                    var dataBody = {
                        outlet_id: ""
                    };

                    if (typeof cartOrder.outlet_id !== 'undefined') {
                        dataBody.outlet_id = cartOrder.outlet_id;
                    }
                    var URL = anything.outletAPIphp + 'send_notification_orders.php';

                    const response = await fetch(URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(dataBody)
                    });

                    var resultData = await response.json();

                    if (!resultData.is_successful) {
                        returnData = JSON.stringify({ status: true, message: 'Error' });
                        res.setHeader('Content-Type', 'application/json');
                        res.send(returnData);
                        return;
                    }
                }

                returnData = JSON.stringify({ status: true, message: 'Midtarans Payment Successfully.' });
                res.setHeader('Content-Type', 'application/json');
                res.send(returnData);
                return;
            }
        }



    },

    callbackGopayV2: async function (req, res) {
        // partner oper data status (done)
        // Insert data callback partner (done)
        // Update Status payment partner (done)
        // jika status terbayar (done)
        // insert orders cechkout ke table orders (done)
        // insert orders detail ambil data dari shopping cart where invoice number (done)
        // insert data jadwal catering, frozen, produk ke data jadwal order catering, frozen, produk (tinggal produk ready to eat)
        // get data detail pembelian untuk data di email
        // send email

        var $q;





        var data = req.body;
        var transaction_time = data.transaction_time;
        var transaction_status = data.transaction_status;
        var transaction_id = data.transaction_id;
        var status_message = data.status_message;
        var status_code = data.status_code;
        var signature_key = data.signature_key;
        var payment_type = data.payment_type;
        var order_id = data.order_id; // invoice id
        var merchant_id = data.merchant_id;
        var gross_amount = data.gross_amount;
        var fraud_status = data.fraud_status;
        var currency = data.currency;

        console.log('callback gopay');
        console.log(data);

        var dataInsert = [
            status_message,
            transaction_id,
            order_id,
            gross_amount,
            payment_type,
            transaction_time,
            transaction_status,
            signature_key,
            JSON.stringify(data)
        ];

        // Insert data callback

        $q = `INSERT INTO partner_callback
            (status_message, transaction_id, invoice_id, gross_amount, payment_type, transaction_time, transaction_status, signature_key, text_callback)
            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
        console.log('Query Insert : ' + $q);
        var connection = await connSentral.getConnection();
        empResult = await connection.executeQuery($q, dataInsert);
        connection.close();
        console.log(empResult);

        if (typeof empResult == 'undefined') {
            var returnData = JSON.stringify({ status: false, message: 'Insert Callback Error' });
            res.setHeader('Content-Type', 'application/json');
            res.send(returnData);
            return false;
        }

        // end
        $q = `SELECT * FROM payment_partner WHERE invoice_id = '` + order_id + `'`;
        connection = await connSentral.getConnection();
        dataPayment = await connection.executeQuery($q);
        connection.close();
        if (typeof empResult == 'undefined') {
            var returnData = JSON.stringify({ status: false, message: 'Insert Callback Error' });
            res.setHeader('Content-Type', 'application/json');
            res.send(returnData);
            return false;
        }

        var status_code_ = '200';
        var gross_amount_ = gross_amount + '.00';
        var serverKey = anything.serverKey;

        var gabung = order_id + status_code_ + gross_amount_ + serverKey;

        var hasilGabung = sha512(gabung);

        if (signature_key !== hasilGabung) {
            var returnData = JSON.stringify({ status: false, message: 'Error Signature key' });
            res.setHeader('Content-Type', 'application/json');
            res.send(returnData);
            return false;
        }

        if (transaction_status === 'settlement') {
            let dataUpdate = {
                    transaction_status: transaction_status
                }

                doTheSettlement(rows);

            } else {
                returnData = JSON.stringify({ status: true, message: 'Sucsessfully' });
                res.setHeader('Content-Type', 'application/json');
                res.send(returnData);
            }
        }
    },
    callbackGopay: async function (req, res) {
        console.log('callback gopay');
        console.log(data);

        var data = req.body;
        var transaction_time = data.transaction_time;
        var transaction_status = data.transaction_status;
        var transaction_id = data.transaction_id;
        var status_message = data.status_message;
        var status_code = data.status_code;
        var signature_key = data.signature_key;
        var payment_type = data.payment_type;
        var order_id = data.order_id; // invoice id
        var merchant_id = data.merchant_id;
        var gross_amount = data.gross_amount;
        var fraud_status = data.fraud_status;
        var currency = data.currency;

        var dataInsert = {
            status_message: status_message,
            transaction_id: transaction_id,
            invoice_id: order_id,
            gross_amount: gross_amount,
            payment_type: payment_type,
            transaction_time: transaction_time,
            transaction_status: transaction_status,
            signature_key: signature_key,
            text_callback: JSON.stringify(data)
        };

        await partnerCallback.insert(dataInsert, function (error, rows) {
            if (error) {
                returnData = JSON.stringify({ status: false, message: 'Member Address Query Error.' });
                res.setHeader('Content-Type', 'application/json');
                res.send(returnData);
                return false;
            } else {
                // sudah terbayar
                if (transaction_status === 'settlement') {

                    let dataUpdate = {
                        transaction_status: transaction_status
                    }

                    doTheSettlement(rows);

                    // update status payment jadi settlement
                    // update status order jadi 2
                    // send email sudah payment
                } else {
                    returnData = JSON.stringify({ status: true, message: 'Sucsessfully' });
                    res.setHeader('Content-Type', 'application/json');
                    res.send(returnData);
                }
            }
        });
    }

}
