import './style.css'
import * as THREE from 'three'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

class VectorSpace {

    //SETTINGS      ->     To be moved to settings argument

    // points       ->     Original (high-dim) positions
    // distances    ->     Precomputed distances in original space
    // forces       ->     Force at given time on every point in 3D
    // accelerations       Acceleration --||--
    // positions    ->     Current positions in 3D


    // Creates a vector space containing "points".
    constructor(points, settings){

        this.settings = {
            k: 10,                  // Number of nearest points that are simulated at a given time
            displayK: 200,          // Number of points displayed at a given time
            weighByDistance: true,
            range: 10, 

            useSpring: true,        // Simulate spring forces
            useRepulsive: false,    // Simulate magnetic repulsive forces
            useDrag: true,          // Simulate "air drag"
            useCooling: false,       // Reduce forces with time from last focus change [todo]

            springConstant: 3,
            repulsionConstant: 0.25,
            mass: 0.1,
            dragConstant: 0.1,
            scaleModifier: 0.2,     // Temporary, all vector spaces should be normalized. [todo]
        }

        Object.assign(this.settings, settings) // Override default settings
        Object.assign(this, this.settings) // Move all properties outside "settings" object

        var hello = [1,2]
        var world = hello[2]

        this.points = points // n*d matrix (2d array) where rows are points and columns are dimensions
        this.n = points.length
        this.distances = VectorSpace.calculateDistances(points)
        this.maxDistance = Math.max(...this.distances[0])

        // this.k = 10 // number of nearest points to display at one time (size of neighbourhood)
        this.selected = 0 //index of currently viewed point
        this.sortedIndices = [...Array(this.n).keys()]
        this.nn = []
        this.nnWeights = new Array(this.n).fill(1)

        // this.range = 10
        // this.springConstant = 3
        // this.repulsionConstant = 0.25
        // this.mass = 0.1
        // this.dragConstant = 0.1
        // this.scaleModifier = 0.2 //TEMPORARY
        // this.weighByDistance = true // springs are stronger for nearer points

        var positionsMatrix = VectorSpace.getRandomPoints(this.n, 3, this.range)
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
                var forceOnI = VectorSpace.fSpring(
                    v1, 
                    v2,
                    this.distances[i][j] * this.scaleModifier,
                    this.springConstant)
                
                // REPULSIVE
                // var repulsive = VectorSpace.fMagneticRepulsive(
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

    static fMagneticRepulsive(v1, v2, constant){
        var dist = v1.distanceTo(v2)
        var unit = v1.clone().sub(v2).normalize()
        var force = unit.multiplyScalar(constant / Math.pow(dist, 2))
        return force
    }

    static fSpring(v1, v2, idealDist, constant){
        idealDist += 1e-10
        var dist = v1.distanceTo(v2)
        var magnitude = constant * Math.log2(dist/idealDist)
        var unit = v2.clone().sub(v1).normalize()
        var force = unit.multiplyScalar(magnitude)
        return force
    }

    // UTILITY
    // Move to utils.js if multiple classes need it

    static eulerDistance(pos1, pos2){
        var sum = 0
        for(var i = 0; i < pos1.length; i++){
            sum += Math.pow(pos1[i] - pos2[i], 2)
        }
        return Math.sqrt(sum)
    }

    static calculateDistances(points){
        var n = points.length
        var dim = points[0].length
        var distances = new Array(n)
        for(var i = 0; i < n; i++){
            distances[i] = new Array(n).fill(0)
            for(var j = 0; j < i; j++){
                var dist = VectorSpace.eulerDistance(points[i], points[j])
                distances[i][j] = dist
                distances[j][i] = dist
            }
        }
        return distances
    }

    static getRandomPoints(n, dim, valueRange){
        var points = new Array(n)
        for(var i = 0; i < n; i++){
            var point = new Array(dim)
            for(var j = 0; j < dim; j++)
                point[j] = (Math.random()-0.5) * valueRange
            points[i] = point
        }
        
        return points
    }

}

export { VectorSpace }