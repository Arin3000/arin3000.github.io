using System;
using UnityEngine;

[ExecuteAlways]
public sealed class CampusPaintingStudy : MonoBehaviour
{
    [Serializable] public class SlotSet { public Renderer renderer; public Material[] original; public Material[] teaching; }
    public SlotSet[] slots;
    [Range(1,10)] public int stage = 10;
    public Camera viewCamera;
    public Vector3 fullPosition, fullTarget, facePosition, faceTarget;
    public static readonly string[] Titles = { "01 铺底色", "02 阴影与肤色", "03 头发高光色块", "04 局部补色", "05 材质反光（含扣子）", "06 眼睛高光贴花", "07 环境补光", "08 轮廓光", "09 描边（教学完整态）", "10 大世界原版完整代码" };
    int applied=-1;
    public void Apply()
    {
        Shader.SetGlobalFloat("_StudyStage",stage);
        if(slots!=null) foreach(var s in slots) if(s.renderer) s.renderer.sharedMaterials=stage==10?s.original:s.teaching;
        applied=stage;
        foreach(var attributes in FindObjectsOfType<SetGlobalAttributes>()) attributes.ApplyNow();
    }
    public void Frame(bool face)
    {
        viewCamera.transform.position=face?facePosition:fullPosition;
        viewCamera.transform.LookAt(face?faceTarget:fullTarget);
    }
    void OnEnable(){Apply();}
    void OnValidate(){applied=-1;}
    void Update(){if(applied!=stage)Apply();}
}
