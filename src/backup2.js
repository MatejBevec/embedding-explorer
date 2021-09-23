import './style.css'
import * as THREE from 'three'
import * as dat from 'dat.gui'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

class VectorSpace {

    //SETTINGS - to be moved to settings argument
    // s

    // points // Original (high-dim) positions
    // distances // (Precomputed distances in original space)
    // forces
    // accelerations
    // positions // Current positions in 3D


    constructor(points){
        /*
            POINTS: n*d matrix (2d array) where rows are points and columns are dimensions
        */
       
        this.points = points
        this.n = points.length
        this.distances = calculateDistances(points)
        this.maxDistance = Math.max(...this.distances[0])
        console.log(this.maxDistance)
        console.log(this.distances)

        this.k = 10 // number of nearest points to display at one time (size of neighbourhood)
        this.selected = 0 //index of currently viewed point
        this.sortedIndices = [...Array(this.n).keys()]
        this.nn = []
        this.nnWeights = new Array(this.n).fill(1)

        this.range = 10
        this.springConstant = 3
        this.repulsionConstant = 0.25
        this.mass = 0.1
        this.dragConstant = 0.1
        this.scaleModifier = 0.2 //TEMPORARY
        this.weighByDistance = true // springs are stronger for nearer points

        var positionsMatrix = getRandomPoints(this.n, 3, this.range)
        this.positions = positionsMatrix.map(p => new THREE.Vector3(p[0], p[1], p[2]))
        this.velocities = []
        for (var i = 0; i < this.n; i++) this.velocities.push(new Vector3())
        this.forces = []
        for (var i = 0; i < this.n; i++) this.forces.push(new Vector3())

        //changeFocus(i)
    }

    changeFocus(i){
        // --- Move to i-th point and display its neighbourhood ---
        this.selected = i
        this.computeNearestNeighbors(i)
        // TODO
    }

    computeNearestNeighbors(i){
        // --- Returns indices (in this.points) of n.n. sorted by distance ---
        // For now: sort distances ... O(n*logn)
        var distToI = this.distances[i]
        console.log(this.sortedIndices)
        this.sortedIndices.sort((a,b) => distToI[a] - distToI[b])

        //if (!k) k = this.k
        console.log(this.sortedIndices)
        this.nn = this.sortedIndices.slice(0, this.k)
    }

    // SIMULATION

    computeForces(){
        for(var i = 0; i < this.n; i++){
            var v1 = this.positions[i]
            for(var j = 0; j < this.n; j++){
                if (i == j) continue

                var v2 = this.positions[j]
                
                // ATTRACTIVE
                var forceOnI = this.fSpring(
                    v1, 
                    v2,
                    this.distances[i][j] * this.scaleModifier,
                    this.springConstant)
                
                // REPULSIVE
                // var repulsive = this.fMagneticRepulsive(
                //     v1,
                //     v2,
                //     this.repulsionConstant
                // )
                // forceOnI.add(repulsive)

                // WEIGHTS - very temporary implementation!
                // (% of largest distance in whole vector space)

                // if (this.weighByDistance && this.selected != 0){  
                //     var avgDist = ( this.distances[this.selected][i]
                //                  + this.distances[this.selected][j] )
                //                  / 2
                //     var weight = Math.pow( (1 - avgDist / this.maxDistance), 4 )
                //     // cca 0.1 force at 40% of maxDistance

                //     forceOnI.multiplyScalar(weight)
                // }

                if (this.weighByDistance && this.nn.indexOf(i) != -1 && this.nn.indexOf(j) != -1){
                    console.log("hello")
                    forceOnI.multiplyScalar(0)}

                // DRAG
                var drag = this.velocities[i].clone().multiplyScalar(
                    -1*this.dragConstant)
                forceOnI.add(drag)

                this.forces[i].add(forceOnI)

            } 
        }
    }

    computeVelocities(dt){
        for(var i = 0; i < this.n; i++){
            var acc = this.forces[i].multiplyScalar(1/this.mass)
            var dv = acc.multiplyScalar(dt)
            this.velocities[i] = this.velocities[i].add(dv)
        }
    }

    updatePositions(dt){
        for(var i = 0; i < this.n; i++){
            var dx = this.velocities[i].multiplyScalar(dt)
            this.positions[i] = this.positions[i].add(dx)
        }
    }

    tick(dt){
        //printV3("pre forces", this.positions)
        this.computeForces()
        //printV3("pre vel", this.positions)
        this.computeVelocities(dt)
        //printV3("pre pos update", this.positions)
        this.updatePositions(dt)
        //printV3("after pos update", this.positions)
    }

    // FORCES

    fMagneticRepulsive(v1, v2, constant){
        var dist = v1.distanceTo(v2)
        var unit = v1.clone().sub(v2).normalize()
        var force = unit.multiplyScalar(constant / Math.pow(dist, 2))
        return force
    }

    fSpring(v1, v2, idealDist, constant){
        idealDist += 1e-10
        var dist = v1.distanceTo(v2)
        var magnitude = constant * Math.log2(dist/idealDist)
        var unit = v2.clone().sub(v1).normalize()
        var force = unit.multiplyScalar(magnitude)
        return force
    }

}

var scene, camera, renderer, controls
var width, height
var objects, lines
var raycaster, pointer, intersectedIndex // scene obj currently under cursor

var selectedIndex
var posTarget, rotTarget // target to lerp camera position to

var vectorSpace // an object holding all "points" in vector space, their projections and corresponding 3D objects

const settings = {
    use_acc: true,
    repulsive_force: true,
    init: "random"
}

const FOV = 75

//runtime
init()
animate()

function init(){
    // initialize scene
    width = window.innerWidth
    height = window.innerHeight
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(FOV,
            width/height,
            0.1,
            10000)
    // camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 10000)
    renderer = new THREE.WebGLRenderer({antialias: true})
    renderer.setSize(width, height)
    renderer.setClearColor(0xffffff, 1)

    raycaster = new THREE.Raycaster()
    pointer = new THREE.Vector2()
    intersectedIndex = null
    selectedIndex = null
    posTarget = null
    rotTarget = null

    document.body.appendChild(renderer.domElement)
    
    // add objects

    var ambLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambLight)
    var dirLight = new THREE.DirectionalLight(0xffffff, 1)
    scene.add(dirLight)
    var lightTarget = new THREE.Object3D(1,0,2)
    scene.add(lightTarget)
    dirLight.target = lightTarget
    
    // INIT POINTS
    var range = 15
    var N = 100
    var points = getRandomPoints(N, 8, range)
    vectorSpace = new VectorSpace(points)
    objects = new Array(points.length)

    for(var i = 0; i < vectorSpace.n; i++){

        var geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2)
        var r = Math.random()
        var g = Math.random()
        var b = Math.random()
        var material = new THREE.MeshLambertMaterial({color: new THREE.Color(r,g,b)})

        var cube = new THREE.Mesh(geometry, material)
        objects[i] = cube
        scene.add(cube)
        cube.position.copy( vectorSpace.positions )
        
    }

    // Add connecting lines to indicated spring tension
    // lines = new Array(vectorSpace.n)
    // for(var i = 0; i < vectorSpace.n; i++){
    //     lines[i] = new Array(vectorSpace.n)
    //     for(var j = 0; j < i; j++){
    //         var vertices = [
    //             vectorSpace.positions[i].clone(),
    //             vectorSpace.positions[j].clone()
    //         ]
    //         var geometry = new THREE.BufferGeometry().setFromPoints(vertices)
    //         var material = new THREE.LineBasicMaterial( {color: 0x000000} )
    //         material.transparent = true

    //         var line = new THREE.Line(geometry, material)
    //         lines[i][j] = line
    //         scene.add(line)
    //     }
    // }

    camera.position.z = 5
    camera.position.x = 3
    camera.position.y = 3
    camera.lookAt(new THREE.Vector3(0,0,0))
    controls = new OrbitControls(camera, renderer.domElement)

    // Event listeners
    document.addEventListener( 'mousemove', onPointerMove )
    document.addEventListener( 'click', onClick )
}

function animate(){
    requestAnimationFrame(animate)
    //controls.update()
    vectorSpace.tick(1/60)

    // --- update node positions ---
    for(var i = 0; i < vectorSpace.n; i++){
        objects[i].position.copy( vectorSpace.positions[i] )
    }

    // --- update connecting lines ---
    // for(var i = 1; i < vectorSpace.n; i++)
    //     for(var j = 0; j < i; j++){
    //         var vertices = [
    //             vectorSpace.positions[i].clone(),
    //             vectorSpace.positions[j].clone()
    //         ]
    //         // lines[i][j].geometry.setAttribute("position", vertices)
    //         lines[i][j].geometry.setFromPoints(vertices)
    //         var dist = vectorSpace.positions[i].distanceTo(vectorSpace.positions[j])
    //         var idealDist = vectorSpace.distances[i][j] * vectorSpace.scaleModifier
    //         lines[i][j].material.opacity = getLineOpacity(dist, idealDist)
    //     }

    // --- find intersections "behind mouse pointer"
    handleIntersections()

    // --- move camera towards target position ---
    var alpha = 0.05
    if (posTarget)
        if (camera.position.distanceTo(posTarget) > 2e-3){
            camera.position.lerp(posTarget, alpha)
            camera.quaternion.slerp(rotTarget, alpha)
        }
        else {
            camera.position.copy(posTarget)
            camera.quaternion.copy(rotTarget)
            posTarget = null
            rotTarget = null
            //controls.target.copy(objects[selectedIndex].position)
        }

    renderer.render(scene, camera)
}

function handleIntersections(){

    raycaster.setFromCamera(pointer, camera) // cast ray
    var intersects = raycaster.intersectObjects(objects) // check intersections among nodes
    
    //console.log(intersects)

    if (intersects.length > 0){
        var obj = intersects[0].object
        // find object index (replace with index property for speed)
        var index = objects.indexOf(obj)

        if (intersectedIndex){
            var prevObj = objects[intersectedIndex]
            prevObj.material.emissive.setHex(prevObj.currentHex)
        }
        intersectedIndex = index
        document.body.style.cursor = "pointer"
        obj.currentHex = obj.material.emissive.getHex()
        obj.material.emissive.setHex(0xff0000) // emissive red for hovered object

    }
    else{
        if (intersectedIndex){
            var prevObj = objects[intersectedIndex]
            prevObj.material.emissive.setHex(prevObj.currentHex)
        }

        document.body.style.cursor = "auto"
        intersectedIndex = null
    }
}

function onPointerMove(e){
    // transform mouse positon to [-1,1] coordinate frame
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
}

function handleFocusChange(){
    if (!intersectedIndex) return

    // Move towards clicked object, up to 5 "units"
    var distance = 2
    var obj = objects[intersectedIndex]
    var hereToObj = obj.position.clone().sub(camera.position).normalize()
    var destination = obj.position.clone().add( hereToObj.multiplyScalar(-distance) )
    var destToObj = obj.position.clone().sub(destination).normalize()
    var rotationMatrix = (new THREE.Matrix4())
        .lookAt(destination, obj.position, new THREE.Vector3(0,1,0))
    rotTarget = (new THREE.Quaternion()).setFromRotationMatrix(rotationMatrix)

    controls.target.copy(obj.position)
    posTarget = destination

    vectorSpace.changeFocus(intersectedIndex)
    indicateNeighbors()
}

function onClick(e){

    handleFocusChange()
    handleIntersections()
}

function indicateNeighbors(){
    var neighbors = vectorSpace.nn
    console.log(neighbors)
    for(var i = 0; i < objects.length; i++){
        objects[i].material.transparent = true
        objects[i].material.opacity = 0.2
    }
    for(var i = 0; i < neighbors.length; i++){
        var obj = objects[neighbors[i]]
        obj.material.transparent = false
        obj.material.opacity = 1
    }
}

function getLineColor(dist, idealDist){
    var color = THREE.color(0.5, 0.5, 0.5)
}

function getLineOpacity(dist, idealDist){
    var long = Math.max(0, Math.sqrt(dist/idealDist) - 1)
    var short = Math.max(0, Math.sqrt(idealDist/dist) - 1)

    return Math.min(1, 0 + long + short) 
}

function getRandomPoints(n, dim, valueRange){
    var points = new Array(n)
    for(var i = 0; i < n; i++){
        var point = new Array(dim)
        for(var j = 0; j < dim; j++)
            point[j] = (Math.random()-0.5) * valueRange
        points[i] = point
    }
    
    return points
}

function eulerDistance(pos1, pos2){
    var sum = 0
    for(var i = 0; i < pos1.length; i++){
        sum += Math.pow(pos1[i] - pos2[i], 2)
    }
    return Math.sqrt(sum)
}

function calculateDistances(points){
    var n = points.length
    var dim = points[0].length
    var distances = new Array(n)
    for(var i = 0; i < n; i++){
        distances[i] = new Array(n).fill(0)
        for(var j = 0; j < i; j++){
            var dist = eulerDistance(points[i], points[j])
            distances[i][j] = dist
            distances[j][i] = dist
        }
    }
    return distances
}

function expMoveTo(obj, to, factor){
    // Temporary - some fancy curve stuff later
    var delta = to.clone().sub(obj.position).multiplyScalar(factor)
    obj.position.add(delta)
}

function printV3(msg, array){
    console.log(msg, array[0].x, array[0].y, array[0].z)
}



