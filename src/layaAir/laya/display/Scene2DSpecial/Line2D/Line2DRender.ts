
import { Laya } from "../../../../Laya";
import { LayaGL } from "../../../layagl/LayaGL";
import { Color } from "../../../maths/Color";
import { Vector2 } from "../../../maths/Vector2";
import { Vector3 } from "../../../maths/Vector3";
import { BaseRenderNode2D } from "../../../NodeRender2D/BaseRenderNode2D";
import { IRenderGeometryElement } from "../../../RenderDriver/DriverDesign/RenderDevice/IRenderGeometryElement";
import { IVertexBuffer } from "../../../RenderDriver/DriverDesign/RenderDevice/IVertexBuffer";
import { RenderState } from "../../../RenderDriver/RenderModuleData/Design/RenderState";
import { BufferUsage } from "../../../RenderEngine/RenderEnum/BufferTargetType";
import { DrawType } from "../../../RenderEngine/RenderEnum/DrawType";
import { IndexFormat } from "../../../RenderEngine/RenderEnum/IndexFormat";
import { MeshTopology } from "../../../RenderEngine/RenderEnum/RenderPologyMode";
import { Shader3D } from "../../../RenderEngine/RenderShader/Shader3D";
import { Context } from "../../../renders/Context";
import { Material } from "../../../resource/Material";
import { Browser } from "../../../utils/Browser";
import { LineShader } from "./shader/Line2DShader";


export class Line2DRender extends BaseRenderNode2D {

    private static defaultDashedValue: Vector3 = new Vector3(20, 0, 0);

    private static defaultLine2DMaterial: Material;

    /**
     * 
     * @returns 
     */
    static _createDefaultLineMaterial(): void {
        if (Line2DRender.defaultLine2DMaterial)
            return;
        LineShader.__init__();
        let mat = Line2DRender.defaultLine2DMaterial = new Material();
        mat.setShaderName("LineShader");
        mat.alphaTest = false;
        mat.depthTest = RenderState.DEPTHTEST_OFF;
        mat.cull = RenderState.CULL_NONE;
        mat.blend = RenderState.BLEND_ENABLE_ALL;
        mat.setIntByIndex(Shader3D.BLEND_SRC, RenderState.BLENDPARAM_SRC_ALPHA);
        mat.setIntByIndex(Shader3D.BLEND_DST, RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA);
        // mat.setVector3ByIndex(LineShader.Dashed, this._dashedValue);
        // mat.setFloatByIndex(LineShader.LineWidth, this._lineWidth);
    }

    private _color: Color = new Color();

    private _positions: number[] = [];//cache line Positions

    private _isdashed: boolean = false;//是否是虚线

    private _dashedValue: Vector3 = new Vector3(20, 0.5, 0);

    private _needUpdate: boolean = false;

    private _maxLineNumer: number = 200;//最大线数量

    private _enLarge: number = 100;//扩线数量


    private _renderGeometry: IRenderGeometryElement;

    private _positionInstansBufferData: Float32Array;

    private _positionVertexBuffer: IVertexBuffer;

    private _lineLengthBufferData: Float32Array;

    private _lineLengthVertexBuffer: IVertexBuffer;

    public get positions(): number[] {
        return this._positions;
    }

    public set positions(value: number[]) {
        if ((value.length / 4) != ((value.length / 4) | 0))//不是4的倍数 直接return
            return;
        this._positions = value;
        this._needUpdate = true;
    }

    private _lineWidth: number = 1;

    public get lineWidth(): number {
        return this._lineWidth;
    }
    public set lineWidth(value: number) {
        this._lineWidth = Math.max(1, value);
        this._spriteShaderData.setNumber(LineShader.LINEWIDTH, this._lineWidth);
    }

    set color(value: Color) {
        if (this._color.equal(value))
            return
        value = value ? value : Color.BLACK;
        value.cloneTo(this._color);
        this._spriteShaderData.setColor(BaseRenderNode2D.BASERENDER2DCOLOR, this._color);
    }

    get color() {
        return this._color;
    }

    set enableDashedMode(value: boolean) {
        this._isdashed = value;
        this._updateDashValue();
    }

    get enableDashedMode(): boolean {
        return this._isdashed;
    }

    set dashedLength(value: number) {
        if (value == null) return;
        value = Math.max(0.01, value);
        this._dashedValue.x = value;
        this._updateDashValue();
    }

    get dashedLength(): number {
        return this._dashedValue.x;
    }

    set dashedPercent(value: number) {
        value = Math.max(Math.min(1, value), 0);
        this._dashedValue.y = value;
        this._updateDashValue();
    }

    get dashedPercent(): number {
        return this._dashedValue.y;
    }

    set dashedOffset(value: number) {
        this._dashedValue.z = value;
        this._updateDashValue();
    }

    get dashedoffset(): number {
        return this._dashedValue.y;
    }

    private _updateDashValue() {
        if (this._isdashed) {
            this._spriteShaderData.setVector3(LineShader.DASHED, this._dashedValue);
        } else {
            this._spriteShaderData.setVector3(LineShader.DASHED, Line2DRender.defaultDashedValue);
        }
    }


    /**
     * 基于不同BaseRender的uniform集合
     * @internal
     */
    protected _getcommonUniformMap(): Array<string> {
        return ["BaseRender2D", "Line2DRender"];
    }

    addPoint(startx: number, starty: number, endx: number, endy: number) {
        this._positions.push(startx, starty, endx, endy);
        this._needUpdate = true;
    }

    /**
    * @internal
    */
    private _changeGeometry() {
        let lineLength = this._positions.length / 4;
        if (lineLength > this._maxLineNumer) {
            //重新创建buffer
            this._maxLineNumer = (((lineLength / this._enLarge) | 0) + 1) * this._enLarge;
            this._positionInstansBufferData = new Float32Array(this._maxLineNumer * 4);
            this._positionVertexBuffer.setDataLength(this._maxLineNumer * 16);
            this._lineLengthBufferData = new Float32Array(this._maxLineNumer * 1);
            this._lineLengthVertexBuffer.setDataLength(this._maxLineNumer * 4);
            this._renderGeometry.bufferState.applyState([LineShader._vbs, this._positionVertexBuffer, this._lineLengthVertexBuffer], LineShader._ibs);
            this._renderElements[0].geometry = this._renderGeometry;
        }

        this._positionInstansBufferData.set(this._positions, 0);
        this._positionVertexBuffer.setData(this._positionInstansBufferData.buffer, 0, 0, this._positionInstansBufferData.byteLength);

        if (true) {//add uv texture
            let totalLength = 0;
            for (var i = 0; i < lineLength; i++) {
                const dataIndex = i * 4;
                this._lineLengthBufferData[i] = totalLength;
                totalLength += Math.hypot(this._positions[dataIndex + 2] - this._positions[dataIndex], this._positions[dataIndex + 3] - this._positions[dataIndex + 1]);
            }
            this._lineLengthVertexBuffer.setData(this._lineLengthBufferData.buffer, 0, 0, this._lineLengthBufferData.byteLength);
        }
        this._renderGeometry.instanceCount = lineLength;
    }

    /**
     * @internal
     * @protected
     * cmd run时调用，可以用来计算matrix等获得即时context属性
     * @param context 
     * @param px 
     * @param py 
     */
    addCMDCall(context: Context, px: number, py: number): void {
        let mat = context._curMat;
        let vec3 = Vector3._tempVector3;
        vec3.x = mat.a;
        vec3.y = mat.c;
        vec3.z = px * mat.a + py * mat.c + mat.tx;
        this._spriteShaderData.setVector3(BaseRenderNode2D.NMATRIX_0, vec3);
        vec3.x = mat.b;
        vec3.y = mat.d;
        vec3.z = px * mat.b + py * mat.d + mat.ty;
        this._spriteShaderData.setVector3(BaseRenderNode2D.NMATRIX_1, vec3);
        this._setRenderSize(context.width, context.height);
        context._copyClipInfoToShaderData(this._spriteShaderData);
    }

    onPreRender(): void {
        if (!this._needUpdate) return;
        this._needUpdate = false;
        this._changeGeometry();
    }

    private _initRender() {  
        let lineNums = this._maxLineNumer;
        let positionBuffer = this._positionVertexBuffer = LayaGL.renderDeviceFactory.createVertexBuffer(BufferUsage.Dynamic);
        positionBuffer.instanceBuffer = true;
        positionBuffer.vertexDeclaration = LineShader.linePoisitionDesc;
        positionBuffer.setDataLength(lineNums * 16);
        this._positionInstansBufferData = new Float32Array(lineNums * 4);

        positionBuffer.setData(this._positionInstansBufferData.buffer, 0, 0, this._positionInstansBufferData.byteLength);

        let lineLengthBuffer = this._lineLengthVertexBuffer = LayaGL.renderDeviceFactory.createVertexBuffer(BufferUsage.Dynamic);
        lineLengthBuffer.instanceBuffer = true;
        lineLengthBuffer.vertexDeclaration = LineShader.lineLengthDesc;
        lineLengthBuffer.setDataLength(lineNums * 4);
        this._lineLengthBufferData = new Float32Array(lineNums * 1);
        lineLengthBuffer.setData(this._lineLengthBufferData.buffer, 0, 0, this._lineLengthBufferData.byteLength);

        //init geomtry
        let geometry = this._renderGeometry = LayaGL.renderDeviceFactory.createRenderGeometryElement(MeshTopology.Triangles, DrawType.DrawElementInstance);
        geometry.bufferState = LayaGL.renderDeviceFactory.createBufferState();
        geometry.setDrawElemenParams(6, 0);
        geometry.indexFormat = IndexFormat.UInt16;
        geometry.instanceCount = 0;
        let buffers = [];
        buffers.push(LineShader._vbs);
        buffers.push(this._positionVertexBuffer);
        buffers.push(this._lineLengthVertexBuffer);
        geometry.bufferState.applyState(buffers, LineShader._ibs);

        //init renderElement
        let renderElement = LayaGL.render2DRenderPassFactory.createRenderElement2D();
        renderElement.geometry = this._renderGeometry;
        renderElement.value2DShaderData = this._spriteShaderData;
        renderElement.renderStateIsBySprite = false;
        renderElement.nodeCommonMap = this._getcommonUniformMap();
        BaseRenderNode2D._setRenderElement2DMaterial(renderElement, this._materials[0] ? this._materials[0] : Line2DRender.defaultLine2DMaterial);
        this._renderElements[0] = renderElement;

    }

    /**
   * @en Render material
   * @zh 渲染材质
   */
    set sharedMaterial(value: Material) {
        super.sharedMaterial = value;
        BaseRenderNode2D._setRenderElement2DMaterial(this._renderElements[0], this._materials[0] ? this._materials[0] : Line2DRender.defaultLine2DMaterial);
    }

    constructor() {
        super();
        Line2DRender._createDefaultLineMaterial();
        this._renderElements = [];
        this._materials = [];
        this._initRender();
        this._spriteShaderData.addDefine(BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
        //this._spriteShaderData.addDefine(Shader3D.getDefineByName("UV"));
        this._spriteShaderData.setColor(BaseRenderNode2D.BASERENDER2DCOLOR, this._color);
    }
}

Laya.addInitCallback(() => Line2DRender._createDefaultLineMaterial());