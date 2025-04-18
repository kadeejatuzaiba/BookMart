



// const pageNotFound=async(req,res)=>{
//     try {
//         res.render('page-404')
//     } catch (error) {
//         res.redirect('/pageNotFound')
//     }
// }

const pageNotFound = async (req, res) => {
    try {
        res.status(404).render('page-404'); // Make sure your view file is named page-404.ejs
    } catch (error) {
        console.log('Error rendering 404 page:', error);
        res.status(500).send('Something went wrong!');
    }
};






const loadHomepage=async(req,res)=>{
    try {
        return res.render('home')
    } catch (error) {
        console.log('Home page not found');
        res.status(500).send('Server error')
        
    }
}

module.exports = {
    loadHomepage,
    pageNotFound,
};
