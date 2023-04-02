$(function(){
    //alert('hola mundo')
    $('#getdatos').on('click', function(){
        console.log('testing')
        $.ajax({
            url: '/prueba',
            success: function(datos){
                console.log(datos)
            }
        })
    })
})